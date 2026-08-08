const mongoose = require('mongoose');

const APP_STATUS = [
  'queued',
  'running',
  'applied',
  'pending',
  'failed',
  'passed',
  'canceled',
  'not_applied',
];
const NOT_APPLIED_REASON = [
  'job_expired',
  'login_failed',
  'site_error',
  'missing_info',
  'location_mismatch',
  'salary_mismatch',
  'blocked_or_captcha',
  'manual_skip',
  'other',
];
const STEP_STATUS = ['queued', 'running', 'done', 'failed', 'waiting'];

const progressStepSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['fetch_jd', 'generate_resume', 'prepare_application', 'submit'], required: true },
    label: { type: String, default: '' },
    status: { type: String, enum: STEP_STATUS, default: 'queued' },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: '' },
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    site: { type: String, enum: ['naukri', 'indeed', 'linkedin'], required: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedResume', default: null },
    batchId: { type: String, default: '' },
    appliedAt: { type: Date, default: null },
    status: { type: String, enum: APP_STATUS, default: 'queued' },
    notAppliedReason: { type: String, enum: NOT_APPLIED_REASON, default: null },
    lastAction: { type: String, default: '' },
    timeline: [timelineEventSchema],
    progress: {
      currentStep: { type: String, default: '' },
      steps: [progressStepSchema],
      attempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ batchId: 1 });
// One active application per job per user (idempotency guard).
applicationSchema.index(
  { userId: 1, jobId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['queued', 'running', 'pending'] } } }
);

module.exports = mongoose.model('Application', applicationSchema);
