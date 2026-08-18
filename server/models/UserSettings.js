const mongoose = require('mongoose');

const blocklistItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 200, trim: true },
    note: { type: String, default: '', maxlength: 200 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, unique: true },
    blocklist: [blocklistItemSchema],
    maxApplyPerBatch: { type: Number, default: 20, min: 1, max: 500 },
    aiDailyBudget: { type: Number, default: 100, min: 0 },
    aiWeeklyBudget: { type: Number, default: 500, min: 0 },
    expireAfterDays: { type: Number, default: 7, min: 1 },
    notifyEmail: { type: Boolean, default: false },
    notifyDigest: { type: String, enum: ['none', 'instant', 'daily'], default: 'instant' },
    pipelinePaused: { type: Boolean, default: false },
    applyRateDelayMs: { type: Number, default: 15000, min: 0, max: 3600000 },
    siteConcurrency: { type: Number, default: 1, min: 1, max: 5 },
    baseResumeTemplates: [{ type: String, maxlength: 100 }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserSettings', userSettingsSchema);
