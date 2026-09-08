const C = require('./jobs.common');
const { Job, mongoose, UserJobSite, UserSettings, Profile, Skill, Experience, Education, Certification, Project, Activity, Application, ApplyField, crypto, asyncHandler, AppError, strArray, str, int, decrypt, getAdapter, SITE_META, isAutomatedSite, buildDedupeKey, parsePostedDate, getUploadedResumeText, toCanonicalKey, getAIClient, sanitizeJdForAI, emitJobsChanged, getQueue, checkAICost, recordAICost, MAX_FETCH_JOBS, TRACKING_STATUSES, NOT_APPLIED_REASONS, getSearchKeywords, applyBlocklist, fetchFromSite, buildProfileText, fallbackMatch } = C;

/**
 * POST /api/jobs/apply
 * Body: { jobIds: string[], batchSize?: number }
 * Enqueues selected jobs into the apply queue and returns a batchId immediately.
 * Respects the master pause/kill-switch and max-per-batch cap from UserSettings.
 */
exports.apply = asyncHandler(async (req, res) => {
  const jobIds = Array.isArray(req.body?.jobIds) ? req.body.jobIds : null;
  if (!jobIds || !jobIds.length) throw new AppError('jobIds required', 400, 'MISSING_JOB_IDS');
  // Reject malformed ids up front — an invalid ObjectId in the $in filter
  // throws a Mongoose CastError and surfaces as a 500 instead of a 400.
  const badIds = jobIds.filter((id) => !mongoose.isValidObjectId(id));
  if (badIds.length) {
    throw new AppError(`Invalid job id(s): ${badIds.slice(0, 5).join(', ')}`, 400, 'INVALID_JOB_ID');
  }

  // Master pause/kill-switch
  const settings = await UserSettings.findOne({ userId: req.adminId }).lean();
  if (settings?.pipelinePaused) {
    throw new AppError('Pipeline is paused. Resume it in settings before applying.', 409, 'PIPELINE_PAUSED');
  }

  const configuredBatch = Number(settings?.maxApplyPerBatch) || 20;
  const requested = parseInt(req.body?.batchSize, 10) || configuredBatch;
  const maxBatch = Math.min(50, Math.max(1, requested));

  const jobs = await Job.find({ userId: req.adminId, _id: { $in: jobIds } }).lean();
  if (!jobs.length) throw new AppError('No jobs found', 404, 'NOT_FOUND');

  const batchId = crypto.randomUUID();
  const queue = await getQueue();
  const enqueued = [];
  const manual = [];
  let alreadyApplied = 0;
  let alreadyActive = 0;

  // Jobs beyond the batch cap are dropped — report them explicitly instead of
  // folding them silently into the skipped count.
  const overCap = Math.max(0, jobs.length - maxBatch);

  for (const job of jobs.slice(0, maxBatch)) {
    // Never re-apply an already-applied job — this is the primary duplicate-
    // apply guard. Applied jobs keep their record (Tracking tab) but are never
    // submitted again.
    if (job.applied || job.status === 'applied') {
      alreadyApplied += 1;
      continue;
    }

    // Jobs on custom sites (or otherwise flagged manual) have no automation:
    // flag them for manual apply instead of queueing a doomed auto-run.
    if (job.needsManualApply || !isAutomatedSite(job.site)) {
      await Job.updateOne(
        { _id: job._id },
        { $set: { needsManualApply: true, manualApplyReason: job.manualApplyReason || 'No automation for this site — apply manually.' } }
      );
      manual.push(job._id);
      continue;
    }

    const existing = await Application.findOne({ userId: req.adminId, jobId: job._id }).lean();
    if (existing && ['queued', 'running', 'pending', 'applied'].includes(existing.status)) {
      alreadyActive += 1;
      continue; // idempotency guard (active OR already-applied)
    }

    let app;
    if (existing) {
      // Reuse a prior terminal/failed application for this job instead of
      // creating a duplicate record (which is what made "retry" look like it
      // discarded the older attempt).
      app = await Application.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            batchId,
            status: 'queued',
            notAppliedReason: null,
            needsManualApply: false,
            manualApplyReason: '',
            appliedAt: null,
            progress: {
              currentStep: '',
              steps: [
                { key: 'fetch_jd', label: 'Fetching job description', status: 'queued' },
                { key: 'generate_resume', label: 'Preparing ATS-friendly resume', status: 'queued' },
                { key: 'prepare_application', label: 'Filling standard profile fields', status: 'queued' },
                { key: 'submit', label: 'Submitting application', status: 'queued' },
              ],
              attempts: (existing.progress?.attempts || 0) + 1,
            },
          },
          $push: { timeline: { event: 'Application queued (reused)', details: `Batch ${batchId}` } },
        },
        { new: true }
      );
    } else {
      app = await Application.create({
        userId: req.adminId,
        jobId: job._id,
        site: job.site,
        batchId,
        status: 'queued',
        timeline: [{ event: 'Application queued', details: `Batch ${batchId}` }],
        progress: {
          currentStep: '',
          steps: [
            { key: 'fetch_jd', label: 'Fetching job description', status: 'queued' },
            { key: 'generate_resume', label: 'Preparing ATS-friendly resume', status: 'queued' },
            { key: 'prepare_application', label: 'Filling standard profile fields', status: 'queued' },
            { key: 'submit', label: 'Submitting application', status: 'queued' },
          ],
        },
      });
    }

    await queue.add('apply', { applicationId: app._id, batchId }, {
      jobId: String(app._id),
      // attempts: 1 — the worker handler persists every failure and never
      // rethrows; Bull retries would re-run an already-handled pipeline.
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
    enqueued.push(app._id);
  }

  emitJobsChanged(req.adminId);

  // Counts come from real jobs only — nonexistent ids are reported separately
  // so "skipped" no longer inflates with ids that matched nothing.
  const notFound = jobIds.length - jobs.length;
  const skipped = alreadyApplied + alreadyActive;
  const notes = [];
  if (manual.length) notes.push(`${manual.length} job(s) need manual application — added to the Manual Apply list.`);
  if (overCap) notes.push(`${overCap} job(s) were over the ${maxBatch}-per-batch cap and were not queued.`);
  if (notFound) notes.push(`${notFound} job id(s) were not found.`);

  res.json({
    batchId,
    queued: enqueued.length,
    skipped,
    alreadyApplied,
    alreadyActive,
    overCap,
    notFound,
    manual: manual.length,
    manualJobIds: manual,
    note: notes.length
      ? notes.join(' ')
      : enqueued.length
        ? 'Applications queued. Watch the Progress panel for live updates.'
        : 'All selected jobs were already queued/running/pending or need manual apply.',
  });
});
/** POST /api/jobs/apply/batch/:batchId/cancel — cancel entire batch. */
exports.cancelBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  await Application.updateMany(
    { userId: req.adminId, batchId, status: { $in: ['queued', 'running'] } },
    { $set: { status: 'canceled' } }
  );
  res.json({ message: 'Batch canceled', canceled: true });
});

/** POST /api/applications/:id/cancel — cancel a single application. */
exports.cancelApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOneAndUpdate(
    { _id: req.params.id, userId: req.adminId, status: { $in: ['queued', 'running'] } },
    { $set: { status: 'canceled' } },
    { new: true }
  );
  if (!app) throw new AppError('Application not found or not cancellable', 404, 'NOT_FOUND');
  res.json({ message: 'Application canceled', application: app });
});
/** POST /api/applications/:id/retry — requeue a failed/not_applied/canceled application. */
exports.retryApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.adminId });
  if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
  if (!['failed', 'not_applied', 'canceled'].includes(app.status)) {
    throw new AppError('Only failed, not_applied, or canceled applications can be retried', 400, 'INVALID_STATUS');
  }
  const job = await Job.findById(app.jobId).lean();
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');
  if (job.status === 'expired') {
    throw new AppError('Job has expired and cannot be retried', 400, 'JOB_EXPIRED');
  }
  if (job.status === 'applied') {
    throw new AppError('Job is already applied and cannot be retried', 400, 'ALREADY_APPLIED');
  }
  // Never auto-resubmit a job that was routed to manual apply (external
  // employer redirect, custom site, or a stored manual-only apply flow).
  if (job.needsManualApply || !isAutomatedSite(job.site)) {
    throw new AppError('This job requires manual application and cannot be auto-retried', 400, 'MANUAL_APPLY_ONLY');
  }

  const settings = await UserSettings.findOne({ userId: req.adminId }).lean();
  if (settings?.pipelinePaused) {
    throw new AppError('Pipeline is paused. Resume it in settings before retrying.', 409, 'PIPELINE_PAUSED');
  }

  const batchId = crypto.randomUUID();
  app.status = 'queued';
  app.batchId = batchId;
  app.notAppliedReason = null;
  app.needsManualApply = false;
  app.manualApplyReason = '';
  app.detectedFields = [];
  app.waitingFields = [];
  app.fieldValues = new Map();
  app.progress = {
    currentStep: '',
    steps: [],
    attempts: (app.progress?.attempts || 0) + 1,
  };
  app.timeline.push({ event: 'Retry queued', details: `Batch ${batchId}` });
  await app.save();

  const queue = await getQueue();
  await queue.add('apply', { applicationId: app._id, batchId }, {
    jobId: String(app._id),
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
  emitJobsChanged(req.adminId);
  res.json({ message: 'Application requeued for retry', application: app });
});
/**
 * POST /api/applications/:id/answers
 * Body: { fields: { key: value }, maybeMore?: boolean }
 * Saves user-provided values for a pending application's waiting fields,
 * learns them into the ApplyField knowledge base (so future applications
 * auto-fill), then automatically requeues the application to resume and
 * submit — no further manual action needed.
 */
exports.submitApplicationAnswers = asyncHandler(async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.adminId });
  if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
  if (app.status !== 'pending') {
    throw new AppError('Only pending applications awaiting user input can be answered', 400, 'INVALID_STATUS');
  }

  const fields = req.body?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new AppError('fields object required', 400, 'MISSING_FIELDS');
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = String(k).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80);
    const value = String(v ?? '').trim().slice(0, 2000);
    if (key && value) sanitized[key] = value;
  }
  if (!Object.keys(sanitized).length) {
    throw new AppError('Provide at least one field value', 400, 'EMPTY_FIELDS');
  }

  // Merge into fieldValues and keep remaining waiting fields that were not
  // answered (in case the user wants to skip some).
  const merged = new Map(app.fieldValues || new Map());
  for (const [k, v] of Object.entries(sanitized)) merged.set(k, v);
  const answeredKeys = new Set(Object.keys(sanitized));
  const remainingWaiting = (app.waitingFields || []).filter((f) => !answeredKeys.has(f.key));

  // Learn each answer for future automatic applications on this site.
  const site = app.site;
  const metaByKey = (app.detectedFields || []).reduce((acc, f) => {
    acc[f.key] = { label: f.label, type: f.type, selector: f.selector, options: f.options };
    return acc;
  }, {});
  for (const [k, v] of Object.entries(sanitized)) {
    const meta = metaByKey[k] || {};
    // Store the canonical semantic key too — without it, user-taught answers
    // never enter the cross-site memory (which only reads rows with a
    // canonicalKey) and the same question would be asked again on every
    // other site instead of auto-filled.
    const canonicalKey = toCanonicalKey(meta.label || '', k);
    await ApplyField.updateOne(
      { userId: req.adminId, site, key: k },
      {
        $set: { label: meta.label || '', type: meta.type || 'text', selector: meta.selector || '', options: meta.options || [], value: v, source: 'user', canonicalKey },
        $inc: { timesUsed: 1 },
      },
      { upsert: true }
    ).catch(() => {});
  }

  const newBatchId = crypto.randomUUID();
  app.status = 'queued';
  app.batchId = newBatchId;
  app.fieldValues = merged;
  app.waitingFields = remainingWaiting;
  app.progress = {
    currentStep: '',
    steps: [],
    attempts: (app.progress?.attempts || 0) + 1,
  };
  app.timeline.push({
    event: 'User filled additional details',
    details: `Answers provided: ${Object.keys(sanitized).join(', ')}. Application resumed automatically.`,
  });
  await app.save();

  const queue = await getQueue();
  await queue.add('apply', { applicationId: app._id, batchId: newBatchId }, {
    jobId: String(app._id),
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });

  res.json({
    message: remainingWaiting.length
      ? 'Answers saved. Application resumed — some fields still need attention.'
      : 'Answers saved. Application resumed and submitting automatically.',
    stillWaiting: remainingWaiting.length,
    application: app,
  });
});
