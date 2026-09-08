const C = require('./jobs.common');
const { Job, mongoose, UserJobSite, UserSettings, Profile, Skill, Experience, Education, Certification, Project, Activity, Application, ApplyField, crypto, asyncHandler, AppError, strArray, str, int, decrypt, getAdapter, SITE_META, isAutomatedSite, buildDedupeKey, parsePostedDate, getUploadedResumeText, toCanonicalKey, getAIClient, sanitizeJdForAI, emitJobsChanged, getQueue, checkAICost, recordAICost, MAX_FETCH_JOBS, TRACKING_STATUSES, NOT_APPLIED_REASONS, getSearchKeywords, applyBlocklist, fetchFromSite, buildProfileText, fallbackMatch } = C;

/** GET /api/jobs/apply/batch/:batchId — aggregate progress of a batch. */
exports.getBatchProgress = asyncHandler(async (req, res) => {
  const apps = await Application.find({ userId: req.adminId, batchId: req.params.batchId })
    .populate('jobId', 'title company site')
    .lean();
  res.json({ batchId: req.params.batchId, total: apps.length, applications: apps });
});
/** GET /api/applications/:id/progress — per-application progress. */
exports.getApplicationProgress = asyncHandler(async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.adminId })
    .populate('jobId', 'title company site')
    .lean();
  if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
  res.json(app);
});
/**
 * GET /api/applications/active
 * Applications currently being worked (queued / running / pending) — used by
 * the UI to rebuild the live progress panel after a refresh or reconnect.
 */
exports.activeApplications = asyncHandler(async (req, res) => {
  const apps = await Application.find({
    userId: req.adminId,
    status: { $in: ['queued', 'running', 'pending'] },
  })
    .populate('jobId', 'title company site')
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  res.json({
    items: apps.map((a) => ({
      applicationId: String(a._id),
      jobId: a.jobId ? String(a.jobId._id || a.jobId) : '',
      batchId: a.batchId || '',
      status: a.status,
      jobTitle: a.jobId?.title || '',
      lastAction: a.lastAction || '',
      currentStep: a.progress?.currentStep || '',
      steps: (a.progress?.steps || []).map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
        error: s.error || '',
      })),
    })),
  });
});
/** GET /api/applications — paginated, filterable application list for Tracking. */
exports.listApplications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.adminId };

  const site = String(req.query.site || '');
  if (site) filter.site = site;
  const status = String(req.query.status || '');
  if (status && status !== 'all') {
    // Ignore unknown status values instead of 400ing — keeps the list view usable.
    if (TRACKING_STATUSES.includes(status)) filter.status = status;
  }
  const via = String(req.query.via || '');
  if (via) filter.appliedVia = via;
  const from = req.query.from;
  if (from) filter.appliedAt = { $gte: new Date(from) };
  const to = req.query.to;
  if (to) {
    if (!filter.appliedAt) filter.appliedAt = {};
    filter.appliedAt.$lte = new Date(to);
  }

  const [total, items] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .populate('jobId', 'title company location site url matchScore resumeId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
/** PUT /api/applications/:id — update an application status (e.g. pending → applied). */
exports.updateApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, userId: req.adminId });
  if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');

  const { status, lastAction } = req.body;
  const patch = {};
  if (status !== undefined) {
    if (!TRACKING_STATUSES.includes(status)) throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    patch.status = status;
    if (status === 'applied') patch.appliedAt = new Date();
  }
  if (lastAction !== undefined && lastAction !== null && lastAction !== '') {
    patch.lastAction = String(lastAction).slice(0, 500);
  }

  const timelineEvents = [];
  if (status !== undefined) {
    timelineEvents.push({ event: `Status updated to ${status}`, details: patch.lastAction || '' });
  }
  if (lastAction && lastAction !== app.lastAction) {
    timelineEvents.push({ event: String(lastAction).slice(0, 200) });
  }

  const update = timelineEvents.length
    ? { $set: patch, $push: { timeline: { $each: timelineEvents } } }
    : { $set: patch };

  const updated = await Application.findByIdAndUpdate(app._id, update, { new: true })
    .populate('jobId', 'title company site')
    .lean();
  if (!updated) throw new AppError('Application not found', 404, 'NOT_FOUND');

  // Keep the Job in sync when an application is marked applied.
  if (status === 'applied') {
    await Job.updateOne(
      { _id: app.jobId },
      { $set: { status: 'applied', applied: true, appliedAt: new Date(), appliedVia: updated.appliedVia || 'manual' } }
    );
  }
  res.json(updated);
});
