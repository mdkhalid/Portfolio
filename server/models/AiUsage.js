const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    // Purpose bucket: 'match' | 'generate_resume' | 'prepare_application' |
    // 'cover_letter' | 'optimize' (open-ended — no enum so new purposes work).
    purpose: { type: String, required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    day: { type: String, index: true }, // UTC date bucket (YYYY-MM-DD)
    week: { type: String, index: true }, // UTC week bucket (YYYY-MM-DD of Monday)
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, day: 1 });
aiUsageSchema.index({ userId: 1, week: 1 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
