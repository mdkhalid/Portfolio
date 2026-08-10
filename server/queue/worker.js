const env = require('../config/env');
const connectDB = require('../config/db');
const Application = require('../models/Application');
const Job = require('../models/Job');
const GeneratedResume = require('../models/GeneratedResume');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const { decrypt } = require('../utils/credentials');
const { getAdapter } = require('../adapters');
const { getAIClient } = require('../ai/client');
const { buildResumePdf } = require('../services/resumePdf');
const { checkAICost, recordAICost } = require('../services/aiCost');
const { getQueue } = require('./index');

const STEPS = ['fetch_jd', 'generate_resume', 'prepare_application', 'submit'];

const STEP_LABELS = {
  fetch_jd: 'Fetching job description',
  generate_resume: 'Preparing ATS-friendly resume',
  prepare_application: 'Filling standard profile fields',
  submit: 'Submitting application',
};

let _io = null;

/** Register the live Socket.io instance for progress broadcasts. */
function setIO(io) {
  _io = io;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (patch.status === 'running') application.progress.currentStep = key;
  application.lastAction = step?.label || key;
  if (patch.status !== prevStatus) {
    const details = patch.error || (patch.status === 'done' ? '' : patch.status);
    application.timeline.push({
      event: `${step?.label || key} ${patch.status === 'done' ? '' : '(' + patch.status + ')'}`.trim(),
      details,
    });
  }
  if (patch.status === 'failed') application.status = 'not_applied';
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
      // Build a tailored, ATS-friendly PDF resume from profile data
      const costCheck = await checkAICost(app.userId, { purpose: 'generate_resume' });
      if (!costCheck.allowed) {
        await Application.updateOne(
          { _id: app._id },
          { $set: { status: 'not_applied', notAppliedReason: costCheck.reason } }
        );
        await markStep(application, key, { status: 'skipped', error: costCheck.reason, finishedAt: new Date() });
        return { skipped: true };
      }

      const [profile, skills, experiences, educationList, certList] = await Promise.all([
        Profile.findOne().lean().catch(() => null),
        Skill.find().lean().catch(() => []),
        Experience.find().lean().catch(() => []),
        Education.find().lean().catch(() => []),
        Certification.find().lean().catch(() => []),
      ]);

      const allSkills = skills
        .flatMap((c) => (Array.isArray(c.items) ? c.items : []))
        .map((s) => (typeof s === 'string' ? s : s?.name || ''))
        .filter(Boolean);

      const pdf = await buildResumePdf({
        name: profile?.name || '',
        title: profile?.title || job.title,
        summary: profile?.summary || '',
        skills: allSkills,
        experience: experiences.map((e) => ({
          role: e.role,
          company: e.company,
          dates: `${e.startDate || ''} - ${e.endDate || 'Present'}`,
          points: e.bullets || [],
        })),
        education: educationList.map((e) => `${e.degree}${e.field ? ' in ' + e.field : ''} — ${e.institution}`),
        certifications: certList.map((c) => `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`),
      });

      const safeTitle = job.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'Resume';
      const safeCompany = job.company.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'Company';
      const pdfFilename = `${safeTitle}_${safeCompany}_resume.pdf`;

      const genResume = await GeneratedResume.create({
        userId: app.userId,
        jobId: job._id,
        applicationId: app._id,
        content: `ATS Tailored Resume for ${job.title} at ${job.company}\n\nSkills: ${allSkills.join(', ')}`,
        pdf,
        pdfFilename,
        jdUsed: (job.description || job.title).slice(0, 8000),
        keywordsMatched: job.matchedKeywords || [],
      });
      await Application.updateOne({ _id: app._id }, { $set: { resumeId: genResume._id } });
      recordAICost({ userId: app.userId, purpose: 'generate_resume', jobId: job._id }).catch(() => {});
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    }

    case 'prepare_application': {
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
          });
          if (result?.error) throw new Error(result.error);
        } else {
          throw new Error(`No submit support for ${site} yet — application not submitted.`);
        }
        lastSubmitAt.set(site, Date.now());
      } finally {
        releaseSiteSlot(site);
      }

      // Mark applied
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      await Application.updateOne(
        { _id: applicationId },
        { $set: { status: 'applied', appliedAt: new Date() } }
      );
      await Job.updateOne(
        { _id: app.jobId },
        { $set: { status: 'applied', applied: true, appliedAt: new Date(), appliedVia: 'system' } }
      );
      break;
    }

    default:
      throw new Error('Unknown step: ' + key);
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

  queue.process('apply', async (job) => {
    const { applicationId } = job.data;
    const app = await Application.findById(applicationId).exec();
    if (!app || app.status === 'canceled') return { skipped: true };

    for (const key of STEPS) {
      if (app.status === 'canceled') break;
      try {
        await runStep(applicationId, key);
      } catch (err) {
        const a = await Application.findById(applicationId).exec();
        if (a) {
          await Application.updateOne(
            { _id: applicationId },
            { $set: { status: 'not_applied', notAppliedReason: String(err?.message || 'site_error').slice(0, 300) } }
          );
        }
        throw err;
      }
    }
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

module.exports = { startWorker, setIO };
