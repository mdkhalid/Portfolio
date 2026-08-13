const env = require('../config/env');
const connectDB = require('../config/db');
const Application = require('../models/Application');
const Job = require('../models/Job');
const GeneratedResume = require('../models/GeneratedResume');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const { decrypt } = require('../utils/credentials');
const { getAdapter } = require('../adapters');
const { isAutomatedSite } = require('../adapters');
const { buildTailoredResume } = require('../services/resumeGenerate');
const { resolveFieldValues, learnFieldValues } = require('../services/applyFields');
const { notify } = require('../services/notifications');
const { getQueue } = require('./index');

const STEPS = ['fetch_jd', 'generate_resume', 'prepare_application', 'submit'];

const STEP_LABELS = {
  fetch_jd: 'Fetching job description',
  generate_resume: 'Preparing ATS-friendly resume',
  prepare_application: 'Filling standard profile fields',
  submit: 'Submitting application',
};

/** Map a raw apply error to a stable, filterable `notAppliedReason` enum. */
function mapNotAppliedReason(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (/login|credential|cookie|authenticate|not logged|sign ?in|sign ?in|session/i.test(msg)) return 'login_failed';
  if (/captcha|blocked|recaptcha|automated|bot detection/i.test(msg)) return 'blocked_or_captcha';
  if (/expired|closed|no longer accepting|not accepting|filled/i.test(msg)) return 'job_expired';
  if (/missing|provide|required/i.test(msg)) return 'missing_info';
  return 'site_error';
}

let _io = null;

/** Register the live Socket.io instance for progress broadcasts. */
function setIO(io) {
  _io = io;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decide whether a submit failure means the user must apply in the browser
 * (external employer redirect, no apply button, non-automated custom site)
 * vs. a transient error that a retry could fix.
 */
function isManualApplyFailure(err) {
  const msg = String(err?.message || '');
  return /employer site|redirected to an employer|no apply button|apply manually|complete the application manually|is not automated|no automation/i.test(msg);
}

const lastSubmitAt = new Map();
const siteSlots = new Map();

async function acquireSiteSlot(site, concurrency) {
  const key = String(site).toLowerCase();
  for (;;) {
    const current = siteSlots.get(key) || 0;
    if (current < concurrency) {
      siteSlots.set(key, current + 1);
      return;
    }
    await sleep(500);
  }
}

function releaseSiteSlot(site) {
  const key = String(site).toLowerCase();
  const current = siteSlots.get(key) || 0;
  siteSlots.set(key, Math.max(0, current - 1));
}

function emitProgress(application) {
  if (!_io) return;
  const payload = {
    applicationId: String(application._id),
    jobId: application.jobId ? String(application.jobId) : '',
    batchId: application.batchId || '',
    status: application.status,
    jobTitle: application.jobTitle || '',
    currentStep: application.progress?.currentStep || '',
    lastAction: application.lastAction || '',
    steps: (application.progress?.steps || []).map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status,
      error: s.error || '',
    })),
  };
  _io.to('admin-room').emit('apply:progress', payload);
  if (payload.batchId) _io.to('admin-room').emit('apply:batch', payload);
}

/** Build a short "<title> · <company> · <site>" string from an application + job. */
function appLabel(app, job) {
  const title = job?.title || app.jobTitle || 'Job';
  const parts = [title];
  if (job?.company) parts.push(job.company);
  if (job?.site) parts.push(job.site);
  return parts.join(' · ');
}

/**
 * When the last active application of a batch reaches a terminal state, emit a
 * single batch_complete notification. Terminal = no queued/running/pending apps left.
 */
async function maybeNotifyBatchComplete(batchId) {
  if (!batchId) return;
  try {
    const apps = await Application.find({ batchId }).select('userId status').lean();
    if (!apps.length) return;
    const nonTerminal = apps.some((a) => ['queued', 'running', 'pending'].includes(a.status));
    if (nonTerminal) return;
    const applied = apps.filter((a) => a.status === 'applied').length;
    const failed = apps.filter((a) => ['failed', 'not_applied'].includes(a.status)).length;
    const needInput = apps.filter((a) => a.status === 'pending').length;
    const canceled = apps.filter((a) => a.status === 'canceled').length;
    await notify({
      userId: apps[0].userId,
      type: 'batch_complete',
      title: 'Apply batch finished',
      body: `${applied} applied · ${failed} failed · ${needInput} need input · ${canceled} canceled`,
      metadata: { batchId, applied, failed, needInput, canceled },
      dedupeKey: `batch-${batchId}`,
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
  } catch (err) {
    console.error('[worker] batch complete notify failed:', err?.message || err);
  }
}

async function markStep(app, key, patch) {
  const application = await Application.findById(app._id).exec();
  if (!application) return;
  let step = application.progress.steps.find((s) => s.key === key);
  if (!step) {
    step = { key, label: STEP_LABELS[key] || key, status: 'queued' };
    application.progress.steps.push(step);
  }
  const prevStatus = step.status;
  Object.assign(step, patch);
  if (patch.status === 'running') {
    application.progress.currentStep = key;
    // Reflect "actively working" so the live panel + Tracking show 'running'
    // instead of 'queued' while the worker is mid-step.
    application.status = 'running';
  }
  application.lastAction = step?.label || key;
  if (patch.status !== prevStatus) {
    const details = patch.error || (patch.status === 'done' ? '' : patch.status);
    application.timeline.push({
      event: `${step?.label || key} ${patch.status === 'done' ? '' : '(' + patch.status + ')'}`.trim(),
      details,
    });
  }
  if (patch.status === 'failed') application.status = 'not_applied';
  if (patch.status === 'waiting_user') application.status = 'pending';
  await application.save();
  // Attach job title for the live progress payload
  const jobDoc = await Job.findById(application.jobId).select('title').lean().catch(() => null);
  emitProgress({ ...application.toObject(), jobTitle: jobDoc?.title || '' });
}

async function runStep(applicationId, key) {
  const app = await Application.findById(applicationId).exec();
  if (!app) throw new Error('Application not found');
  const job = await Job.findById(app.jobId).exec();
  if (!job) throw new Error('Job record not found');

  const application = { _id: app._id };
  await markStep(application, key, { status: 'running', startedAt: new Date() });

  switch (key) {
    case 'fetch_jd': {
      let jd = job.description || '';
      if (!jd || jd.length < 30) {
        const siteDoc = await UserJobSite.findOne({ userId: app.userId, name: job.site }).select('+credentials +cookies').lean();
        const adapter = getAdapter(job.site);
        const tryFetch = async () => {
          const full = await adapter.fetchJobDescription({ url: job.url });
          return full?.description || full || '';
        };

        // JD pages are usually public — try to fetch before any login so the
        // shared browser session isn't poisoned by a CAPTCHA login attempt.
        if (job.url) {
          try {
            jd = await tryFetch();
          } catch (e) {
            console.error('[worker] fetch_jd (unauth) failed:', e?.message || e);
          }
          if (!jd || jd.length < 30) {
            const creds = siteDoc?.credentials ? decrypt(siteDoc.credentials) : null;
            const cookieHeader = siteDoc?.cookies ? decrypt(siteDoc.cookies)?.value : null;
            try {
              if (cookieHeader) {
                await adapter.login({ cookies: cookieHeader, cookieOrigin: job.url });
              } else if (creds?.email && creds?.password) {
                await adapter.login({ email: creds.email, password: creds.password });
              }
              jd = await tryFetch();
            } catch (e) {
              console.error('[worker] fetch_jd (login fallback) failed:', e?.message || e);
            }
          }
        }
        if (jd && jd.length >= 30) {
          await Job.updateOne({ _id: job._id }, { $set: { description: jd } });
        }
      }
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    }

    case 'generate_resume': {
      // Prefer a tailored resume already attached to the job (from
      // POST /api/resume/generate). Fall back to generating one here.
      if (job.resumeId) {
        const attached = await GeneratedResume.findById(job.resumeId).lean().catch(() => null);
        if (attached) {
          await Application.updateOne({ _id: app._id }, { $set: { resumeId: attached._id } });
          await markStep(application, key, { status: 'done', finishedAt: new Date() });
          break;
        }
      }

      // Build a tailored, ATS-friendly PDF resume from profile data
      const built = await buildTailoredResume(job, { userId: app.userId, skipOnBudgetExceeded: true });
      if (built.aiSkipped) {
        await Application.updateOne(
          { _id: app._id },
          { $set: { status: 'not_applied', notAppliedReason: built.reason } }
        );
        await markStep(application, key, { status: 'skipped', error: built.reason, finishedAt: new Date() });
        notify({
          userId: app.userId,
          type: 'ai_budget',
          title: 'AI budget reached — resume skipped',
          body: `Resume generation paused for ${appLabel(app, job)}.`,
          metadata: { applicationId: String(app._id), jobId: String(job._id), jobTitle: job.title, company: job.company },
          dedupeKey: `ai-budget-app-${app._id}`,
        }).catch(() => {});
        return { skipped: true };
      }

      const genResume = await GeneratedResume.create({
        userId: app.userId,
        jobId: job._id,
        applicationId: app._id,
        content: built.content,
        pdf: built.pdf,
        pdfFilename: built.pdfFilename,
        jdUsed: built.jdUsed,
        keywordsMatched: built.keywordsMatched,
      });
      await Application.updateOne({ _id: app._id }, { $set: { resumeId: genResume._id } });
      await Job.updateOne({ _id: job._id }, { $set: { resumeId: genResume._id } });
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    }

    case 'prepare_application': {
      // Already resolved (e.g. user filled fields earlier) → use as-is.
      const existingFields = app.fieldValues ? Object.fromEntries(app.fieldValues) : {};
      if (Object.keys(existingFields).length > 0) {
        await markStep(application, key, { status: 'done', finishedAt: new Date() });
        break;
      }

      // Best-effort detect the apply form fields. If detection fails or the
      // site has no inline form, there is nothing to stage → proceed.
      let detected = [];
      const adapter = getAdapter(job.site);
      if (typeof adapter.detectApplyFields === 'function') {
        try {
          detected = await adapter.detectApplyFields({ url: job.url }) || [];
        } catch (err) {
          console.error('[worker] prepare_application detect failed:', err?.message || err);
        }
      }

      let fieldValues = {};
      let fieldMeta = {};
      let waitingFields = [];
      if (detected.length) {
        const resolved = await resolveFieldValues({
          userId: app.userId,
          site: job.site,
          detected,
          jobTitle: job.title,
        });
        fieldValues = resolved.fieldValues;
        fieldMeta = resolved.fieldMeta;
        waitingFields = resolved.waitingFields;
      }

      // Stage resolved values on the application for the submit step.
      await Application.updateOne(
        { _id: app._id },
        {
          $set: {
            detectedFields: detected,
            fieldValues,
            waitingFields,
          },
        }
      );

      if (waitingFields.length) {
        const needed = waitingFields.map((f) => f.label || f.key).join(', ');
        await markStep(application, key, {
          status: 'waiting_user',
          error: `Needs your attention: ${needed}`,
          finishedAt: new Date(),
        });
        notify({
          userId: app.userId,
          type: 'needs_input',
          title: `Job needs your attention — ${job.title}`,
          body: `${job.company || job.site} needs input: ${needed}.`,
          metadata: { applicationId: String(app._id), jobId: String(job._id), jobTitle: job.title, company: job.company },
          dedupeKey: `needs-input-${app._id}`,
          maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        }).catch(() => {});
        return { waiting: true };
      }

      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    }

    case 'submit': {
      const site = job.site || 'unknown';
      const adapter = getAdapter(site);
      const siteDoc = await UserJobSite.findOne({ userId: app.userId, name: site }).select('+credentials +cookies').lean();

      // Enforce rate limit + per-site concurrency before hitting the site.
      const settings = await UserSettings.findOne().lean().catch(() => null);
      const rateDelayMs = Math.max(0, settings?.applyRateDelayMs || 15000);
      const siteConcurrency = Math.max(1, settings?.siteConcurrency || 1);

      await acquireSiteSlot(site, siteConcurrency);
      try {
        const lastSubmit = lastSubmitAt.get(site) || 0;
        const waitMs = lastSubmit + rateDelayMs - Date.now();
        if (waitMs > 0) await sleep(waitMs);

        const creds = siteDoc?.credentials ? decrypt(siteDoc.credentials) : null;
        const cookieHeader = siteDoc?.cookies ? decrypt(siteDoc.cookies)?.value : null;
        const resume = app.resumeId
          ? await GeneratedResume.findById(app.resumeId).lean().catch(() => null)
          : null;

        // Applying on automated sites (Naukri/Indeed/YC) requires a logged-in
        // session. Without saved credentials or a session cookie the browser run
        // is doomed — surface a clear, retryable reason instead.
        if (!cookieHeader && !(creds?.email && creds?.password)) {
          throw new Error(
            `Login required for ${site} — no saved credentials or session cookie. Add them in the Job Sites tab, then retry.`
          );
        }

        if (cookieHeader) {
          await adapter.login({ cookies: cookieHeader, cookieOrigin: job.url }).catch(() => {});
        } else if (creds?.email && creds?.password) {
          await adapter.login({ email: creds.email, password: creds.password }).catch((e) => {
            console.error('[worker] submit login failed:', e?.message || e);
          });
        }

        if (typeof adapter.submitApplication === 'function') {
          const result = await adapter.submitApplication({
            url: job.url,
            credentials: { email: creds?.email, password: creds?.password },
            resume: resume?.pdf || null,
            resumeFilename: resume?.pdfFilename || '',
            fields: app.fieldValues ? Object.fromEntries(app.fieldValues) : {},
            detected: app.detectedFields || [],
          });
          if (result?.error) throw new Error(result.error);

          // The adapter didn't throw, but it may report the application was
          // NOT actually submitted (e.g. needsManualApply, external redirect,
          // or success indicator missing).  Honour that signal instead of
          // blindly marking "applied".
          if (result && result.applied === false) {
            const reason = result.reason || 'Application could not be confirmed on the site.';
            // Route into Manual Apply if the adapter says so (YC, custom sites).
            if (result.needsManualApply) {
              await Application.updateOne(
                { _id: applicationId },
                { $set: { status: 'not_applied', notAppliedReason: reason, needsManualApply: true, manualApplyReason: reason } }
              );
              await Job.updateOne(
                { _id: app.jobId },
                { $set: { needsManualApply: true, manualApplyReason: reason } }
              );
              await markStep(application, key, { status: 'done', finishedAt: new Date() });
              lastSubmitAt.set(site, Date.now());
              break; // skip the "mark applied" block below
            }
            throw new Error(reason);
          }
        } else {
          throw new Error(`No submit support for ${site} yet — application not submitted.`);
        }
        lastSubmitAt.set(site, Date.now());
      } finally {
        releaseSiteSlot(site);
      }

      // Learn the resolved field values into the knowledge base so future
      // applications on this site auto-fill (keeps bulk apply automatic).
      if (app.fieldValues && Object.keys(Object.fromEntries(app.fieldValues)).length) {
        await learnFieldValues({
          userId: app.userId,
          site,
          fieldValues: Object.fromEntries(app.fieldValues),
          fieldMeta: (app.detectedFields || []).reduce((acc, f) => {
            acc[f.key] = { label: f.label, type: f.type, selector: f.selector, options: f.options };
            return acc;
          }, {}),
        }).catch(() => {});
      }

      // Mark applied
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      await Application.updateOne(
        { _id: applicationId },
        { $set: { status: 'applied', appliedAt: new Date(), appliedVia: 'system' } }
      );
      await Job.updateOne(
        { _id: app.jobId },
        { $set: { status: 'applied', applied: true, appliedAt: new Date(), appliedVia: 'system' } }
      );
      notify({
        userId: app.userId,
        type: 'apply_success',
        title: `Applied — ${job.title}`,
        body: `${job.company || ''}${job.company ? ' · ' : ''}${job.site}`,
        metadata: { applicationId: String(app._id), jobId: String(job._id), jobTitle: job.title, company: job.company },
        dedupeKey: `apply-success-${app._id}`,
      }).catch(() => {});
      break;
    }

    default:
      throw new Error('Unknown step: ' + key);
  }
}

async function rescueStuckApplications() {
  try {
    // Applications left 'queued'/'running' by a previous process (crash/restart,
    // or an in-memory queue that lost jobs) never finish. Re-queue any that
    // haven't been touched for a while so the pipeline picks them back up.
    const cutoff = new Date(Date.now() - 60 * 1000);
    const stuck = await Application.find({
      status: { $in: ['queued', 'running'] },
      updatedAt: { $lt: cutoff },
    })
      .select('_id batchId')
      .limit(100)
      .lean();
    if (!stuck.length) return;
    const queue = await getQueue();
    for (const app of stuck) {
      await Application.updateOne({ _id: app._id }, { $set: { status: 'queued' } });
      await queue.add('apply', { applicationId: app._id, batchId: app.batchId || '' }, {
        jobId: String(app._id),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
    }
    console.log(`[worker] requeued ${stuck.length} interrupted application(s) after restart`);
  } catch (err) {
    console.error('[worker] rescue stuck applications failed:', err?.message || err);
  }
}

async function startWorker() {
  const mongoose = require('mongoose');
  // Wait for the main server's in-flight DB connection if one exists.
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) return resolve();
      const done = () => {
        clearTimeout(fallback);
        resolve();
      };
      const onConnected = () => done();
      const onErr = (err) => {
        console.error('[worker] DB connection error:', err?.message || err);
        done();
      };
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onErr);
      // Fallback timeout (unref'd so it never keeps the process alive).
      const fallback = setTimeout(() => onErr(new Error('DB connection timeout')), 12000);
      fallback.unref();
    });
  }
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  const queue = await getQueue();
  await rescueStuckApplications();

  queue.process('apply', async (job) => {
    const { applicationId } = job.data;
    const app = await Application.findById(applicationId).exec();
    if (!app || app.status === 'canceled') return { skipped: true };

    for (const key of STEPS) {
      if (app.status === 'canceled') break;
      try {
        const result = await runStep(applicationId, key);
        // Stop the chain when a step needs user input or was skipped —
        // don't let submit run on a not_applied/pending application.
        if (result?.waiting || result?.skipped) break;
      } catch (err) {
        const a = await Application.findById(applicationId).exec();
        if (a) {
          const manualApply = isManualApplyFailure(err);
          const rawReason = String(err?.message || 'site_error').slice(0, 500);
          await Application.updateOne(
            { _id: applicationId },
            { $set: {
                status: 'not_applied',
                notAppliedReason: mapNotAppliedReason(err),
                lastAction: rawReason,
                needsManualApply: manualApply,
                manualApplyReason: manualApply ? rawReason : '',
              } }
          );
          // Persist the raw failure detail on the submit step + timeline so the
          // user sees exactly why, while the enum reason stays filterable.
          await Application.updateOne(
            { _id: applicationId, 'progress.steps.key': 'submit' },
            { $set: { 'progress.steps.$.error': rawReason, 'progress.steps.$.status': 'failed' } }
          ).catch(() => {});
          // Route the job into the Manual Apply list so the user can finish in
          // the browser (external employer redirect / no automation for site).
          if (a.jobId && manualApply) {
            await Job.updateOne(
              { _id: a.jobId },
              { $set: { needsManualApply: true, manualApplyReason: rawReason } }
            );
          }
          const jobDoc = a.jobId ? await Job.findById(a.jobId).select('title company site').lean().catch(() => null) : null;
          notify({
            userId: a.userId,
            type: 'apply_failed',
            title: `Apply failed — ${jobDoc?.title || 'job'}`,
            body: String(err?.message || 'site_error').slice(0, 200),
            metadata: { applicationId: String(a._id), jobId: a.jobId ? String(a.jobId) : '', jobTitle: jobDoc?.title || '', company: jobDoc?.company },
            dedupeKey: `apply-failed-${applicationId}`,
          }).catch(() => {});
        }
        throw err;
      }
    }
    await maybeNotifyBatchComplete(app.batchId || '');
    return { done: true };
  });

  console.log('[worker] applyQueue worker started');
}

if (require.main === module) {
  startWorker().catch((err) => {
    console.error('[worker] failed to start:', err);
    process.exit(1);
  });
}

module.exports = { startWorker, setIO, maybeNotifyBatchComplete };
