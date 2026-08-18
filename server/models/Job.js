const mongoose = require('mongoose');

const JOB_STATUS = ['new', 'pending', 'applied', 'passed', 'not_applied', 'expired'];
const APPLIED_VIA = ['system', 'imported', 'manual'];

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    title: { type: String, required: true, maxlength: 200, trim: true },
    company: { type: String, required: true, maxlength: 200, trim: true },
    location: { type: String, default: '', maxlength: 200, trim: true },
    salary: { type: String, default: '', maxlength: 200, trim: true },
    description: { type: String, default: '' },
    url: { type: String, default: '', maxlength: 1000 },
    site: { type: String, required: true },
    siteJobId: { type: String, default: '' },
    dedupeKey: { type: String, required: true, maxlength: 64 },
    postedDate: { type: Date, default: null, index: true },
    lastSeenAt: { type: Date, default: Date.now },
    matchScore: { type: Number, min: 0, max: 100, default: null },
    matchedKeywords: [{ type: String, maxlength: 100 }],
    missingKeywords: [{ type: String, maxlength: 100 }],
    applied: { type: Boolean, default: false },
    appliedAt: { type: Date, default: null },
    appliedVia: { type: String, enum: APPLIED_VIA, default: null },
    status: { type: String, enum: JOB_STATUS, default: 'new' },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedResume', default: null },
    // Set when the job could not be auto-submitted (external employer redirect /
    // custom site) and the user must apply in the browser, then mark applied.
    needsManualApply: { type: Boolean, default: false },
    manualApplyReason: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

jobSchema.index({ userId: 1, status: 1 });
jobSchema.index({ userId: 1, site: 1 });
jobSchema.index({ userId: 1, needsManualApply: 1 });
jobSchema.index({ userId: 1, postedDate: 1 });
// Per-user dedupe uniqueness (dedupeKey alone is globally unique; combine with userId).
jobSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });

module.exports = mongoose.model('Job', jobSchema);
