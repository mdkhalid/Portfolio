const mongoose = require('mongoose');

const SEVERITY = ['SEV1', 'SEV2', 'SEV3'];
const STATUS = ['resolved', 'mitigated', 'monitoring', 'ongoing'];
const DETECTION = ['pagerduty', 'customer_report', 'internal_monitoring', 'on_call', 'social_media', 'synthetic', 'other'];
const ACTION_STATUS = ['todo', 'in_progress', 'done', 'wont_fix'];
const ACTION_PRIORITY = ['P0', 'P1', 'P2', 'P3'];

const actionItemSchema = new mongoose.Schema({
  action: { type: String, required: true, maxlength: 500 },
  owner: { type: String, default: '', maxlength: 100 },
  status: { type: String, enum: ACTION_STATUS, default: 'todo' },
  priority: { type: String, enum: ACTION_PRIORITY, default: 'P1' },
}, { _id: false });

const timelineEventSchema = new mongoose.Schema({
  time: { type: String, default: '' },       // "14:02 UTC" or "+14 min"
  label: { type: String, required: true, maxlength: 200 },
}, { _id: false });

const postmortemSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, maxlength: 200 },
  excerpt: { type: String, default: '', maxlength: 500 },
  severity: { type: String, enum: SEVERITY, required: true, default: 'SEV3' },
  status: { type: String, enum: STATUS, default: 'resolved' },
  incidentDate: { type: Date, required: true },
  resolvedDate: { type: Date, default: null },
  durationMinutes: { type: Number, default: 0, min: 0 },
  systemsAffected: [{ type: String, maxlength: 100 }],
  customerImpact: { type: String, default: '', maxlength: 1000 },
  detectionSource: { type: String, enum: DETECTION, default: 'internal_monitoring' },
  rootCause: { type: String, default: '', maxlength: 2000 },
  contributingFactors: [{ type: String, maxlength: 200 }],
  whatWentWell: [{ type: String, maxlength: 300 }],
  whatDidntGoWell: [{ type: String, maxlength: 300 }],
  actionItems: [actionItemSchema],
  timeline: [timelineEventSchema],
  content: { type: String, default: '' },
  tags: [{ type: String, maxlength: 40 }],
  coverImage: { type: String, default: '' },
  published: { type: Boolean, default: false },
}, { timestamps: true });

postmortemSchema.index({ severity: 1, status: 1, incidentDate: -1 });

module.exports = mongoose.model('Postmortem', postmortemSchema);
module.exports.SEVERITY = SEVERITY;
module.exports.STATUS = STATUS;
module.exports.DETECTION = DETECTION;
module.exports.ACTION_STATUS = ACTION_STATUS;
module.exports.ACTION_PRIORITY = ACTION_PRIORITY;
