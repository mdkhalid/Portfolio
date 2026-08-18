const mongoose = require('mongoose');

const STEP_KINDS = [
  'login',
  'search',
  'fetch_jd',
  'detect_fields',
  'fill_fields',
  'upload_resume',
  'submit',
  'confirm',
  'manual_apply',
];

const applyStepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: '' },
    kind: { type: String, enum: STEP_KINDS, required: true },
    selectors: [{ type: String }],
    // Decision/branch notes for this step (e.g. external redirect -> manual apply).
    branch: { type: String, default: '' },
    manualApplyCondition: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Structured, persistent description of how a job provider applies to a job.
 * Seeded from the hand-written adapters so the flow is inspectable, editable,
 * and usable as LLM context (Phase 3).
 */
const applyFlowSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    steps: { type: [applyStepSchema], default: [] },
    // True when the provider has no auto-apply (custom sites / YC single application).
    manualApply: { type: Boolean, default: false },
    manualApplyReason: { type: String, default: '' },
    source: { type: String, enum: ['adapter', 'seed', 'user'], default: 'seed' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApplyFlow', applyFlowSchema);
