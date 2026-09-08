const C = require('./jobs.common');
const { Job, mongoose, UserJobSite, UserSettings, Profile, Skill, Experience, Education, Certification, Project, Activity, Application, ApplyField, crypto, asyncHandler, AppError, strArray, str, int, decrypt, getAdapter, SITE_META, isAutomatedSite, buildDedupeKey, parsePostedDate, getUploadedResumeText, toCanonicalKey, getAIClient, sanitizeJdForAI, emitJobsChanged, getQueue, checkAICost, recordAICost, MAX_FETCH_JOBS, TRACKING_STATUSES, NOT_APPLIED_REASONS, getSearchKeywords, applyBlocklist, fetchFromSite, buildProfileText, fallbackMatch } = C;

/** GET /api/jobs — paginated, filterable job list (Phase 2 UI). */
exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.adminId };

  const site = req.query.site;
  if (site) filter.site = site;
  const manual = req.query.manual;
  const status = req.query.status;
  if (status) {
    // status=all means "show everything" (applied, passed, expired, etc.)
    if (status !== 'all') filter.status = status;
  } else if (manual !== '1' && manual !== 'true') {
    // Default view is the actionable queue only — jobs already applied or
    // passed live on the Tracking tab (Applications) instead of the list.
    filter.status = { $in: ['new', 'pending', 'not_applied'] };
  }
  if (manual === '1' || manual === 'true') {
    filter.needsManualApply = true;
    filter.status = { $in: ['new', 'not_applied', 'pending'] };
  }
  const age = req.query.age; // 24h | 3d | 7d | 14d
  if (age) {
    const hours = { '24h': 24, '3d': 72, '7d': 168, '14d': 336 }[age];
    if (hours) filter.postedDate = { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
  }
  const minScore = parseInt(req.query.minScore, 10);
  if (!Number.isNaN(minScore)) filter.matchScore = { $gte: minScore };
  const q = String(req.query.q || '').trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: re }, { company: re }];
  }

  const [total, items] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .sort({ postedDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
/** PUT /api/jobs/:id — update job status (apply/pass). */
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await Job.findOne({ _id: id, userId: req.adminId });
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

  const updates = {};
  if (req.body.status) {
    const validStatuses = ['new', 'pending', 'applied', 'passed', 'not_applied', 'expired'];
    if (!validStatuses.includes(req.body.status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }
    updates.status = req.body.status;
    if (req.body.status === 'applied') {
      updates.applied = true;
      updates.appliedAt = new Date();
      // Distinct from manual_browser (finished in their own browser) and system
      // (auto-apply): the user just marked the job applied from the list.
      updates.appliedVia = 'manual_mark';
    }
  }

  const updated = await Job.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

  // A manual "applied" while an automated application is queued/running would
  // let the worker submit the same job again — cancel the in-flight run first.
  if (req.body.status === 'applied') {
    await Application.updateMany(
      { userId: req.adminId, jobId: id, status: { $in: ['queued', 'running'] } },
      { $set: { status: 'canceled' } }
    );
  }

  // Keep the Tracking tab unified: manual apply/pass also surfaces as an
  // Application record so it appears alongside system/imported applications.
  if (req.body.status === 'applied' || req.body.status === 'passed') {
    const existing = await Application.findOne({ userId: req.adminId, jobId: id }).sort({ createdAt: -1 }).lean();
    if (existing) {
      if (req.body.status === 'applied' && existing.status !== 'applied') {
        await Application.updateOne(
          { _id: existing._id },
          { $set: { status: 'applied', appliedAt: new Date(), appliedVia: 'manual_mark' } }
        );
      }
    } else {
      await Application.create({
        userId: req.adminId,
        jobId: id,
        site: job.site,
        status: req.body.status,
        appliedAt: req.body.status === 'applied' ? new Date() : null,
        appliedVia: 'manual_mark',
        timeline: [{ event: req.body.status === 'applied' ? 'Marked as applied (manual)' : 'Marked as passed (manual)' }],
      });
    }
  }

  emitJobsChanged(req.adminId);

  res.json(updated);
});
// ─── Manual Apply ────────────────────────────────────────────────────────────

/**
 * GET /api/jobs/manual — jobs that need the user to apply in the browser
 * (external employer redirects, custom sites with no automation).
 */
exports.manualList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.adminId, needsManualApply: true };

  const status = String(req.query.status || '');
  if (status && status !== 'all') {
    const valid = ['new', 'not_applied', 'pending'];
    // Ignore unknown status values instead of 400ing — keeps the list view usable.
    if (valid.includes(status)) filter.status = status;
  }
  const site = String(req.query.site || '');
  if (site) filter.site = site;

  const [total, items] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

/**
 * POST /api/jobs/manual — add a job by hand for a custom/manual site.
 * Body: { title, company, url, site, location? }. Dedupes on url+title.
 */
exports.manualCreate = asyncHandler(async (req, res) => {
  const title = str(req.body, 'title', { min: 2, max: 200 });
  const company = str(req.body, 'company', { min: 1, max: 200 });
  const url = str(req.body, 'url', { min: 8, max: 1000 });
  const site = str(req.body, 'site', { min: 1, max: 50 }).toLowerCase();
  const location = str(req.body, 'location', { max: 200, optional: true }) || '';

  const siteDoc = await UserJobSite.findOne({ userId: req.adminId, name: site }).lean();
  if (!siteDoc) throw new AppError('Unknown site. Add it in the Job Sites tab first.', 400, 'INVALID_SITE');

  const dedupeKey = buildDedupeKey({ title, company, location });
  const existing = await Job.findOne({ userId: req.adminId, dedupeKey }).lean();
  if (existing) {
    // Re-flag an already-tracked job so it reappears in the Manual Apply list.
    await Job.updateOne({ _id: existing._id }, { $set: { needsManualApply: true, manualApplyReason: 'Added manually', status: 'new' } });
    return res.json({ job: existing, duplicate: true });
  }

  const job = await Job.create({
    userId: req.adminId,
    title,
    company,
    location,
    url,
    site,
    siteJobId: '',
    dedupeKey,
    postedDate: new Date(),
    lastSeenAt: new Date(),
    status: 'new',
    needsManualApply: true,
    manualApplyReason: 'Added manually',
  });
  res.status(201).json({ job });
});

/** POST /api/jobs/:id/mark-applied — user finished applying in the browser. */
exports.manualMarkApplied = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await Job.findOneAndUpdate(
    { _id: id, userId: req.adminId },
    {
      $set: {
        status: 'applied',
        applied: true,
        appliedAt: new Date(),
        // Distinct from manual_mark (marked from the list without applying):
        // the user actually completed the application in their browser.
        appliedVia: 'manual_browser',
        needsManualApply: false,
        manualApplyReason: '',
      },
    },
    { new: true }
  ).lean();
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

  // Cancel any queued/running automated run FIRST — the worker re-checks
  // cancellation between steps, so this stops a mid-flight run from also
  // submitting (duplicate). Setting the active record straight to 'applied'
  // would not stop the worker, which holds its own cached copy.
  await Application.updateMany(
    { userId: req.adminId, jobId: id, status: { $in: ['queued', 'running'] } },
    { $set: { status: 'canceled' } }
  );

  // Track the manual apply in the latest Application record. Prefer updating
  // a non-active record; otherwise create a new one (the unique index only
  // covers queued/running/pending, all canceled above, so this cannot clash).
  const existingApp = await Application.findOne(
    { userId: req.adminId, jobId: id, status: { $nin: ['queued', 'running'] } }
  ).sort({ createdAt: -1 }).lean();
  if (existingApp) {
    await Application.updateOne(
      { _id: existingApp._id },
      { $set: { status: 'applied', appliedAt: new Date(), appliedVia: 'manual_browser', needsManualApply: false } }
    );
  } else {
    await Application.create({
      userId: req.adminId,
      jobId: id,
      site: job.site,
      status: 'applied',
      appliedAt: new Date(),
      appliedVia: 'manual_browser',
      needsManualApply: false,
      timeline: [{ event: 'Applied manually in the browser' }],
    });
  }

  emitJobsChanged(req.adminId);

  res.json(job);
});

/** PUT /api/jobs/:id/mark-pass — user chose not to apply. */
exports.manualMarkPass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await Job.findOneAndUpdate(
    { _id: id, userId: req.adminId },
    { $set: { status: 'passed', needsManualApply: false, manualApplyReason: '' } },
    { new: true }
  ).lean();
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');
  const existingApp = await Application.findOne({ userId: req.adminId, jobId: id }).sort({ createdAt: -1 }).lean();
  if (existingApp) {
    await Application.updateOne({ _id: existingApp._id }, { $set: { status: 'passed', needsManualApply: false } });
  }
  emitJobsChanged(req.adminId);
  res.json(job);
});

