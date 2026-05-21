const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['message', 'resume_download', 'page_view'],
  },
  description: { type: String, required: true },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

// Index for efficient queries and auto-cleanup
activitySchema.index({ createdAt: -1 });

// Keep only the last 500 activity records
activitySchema.statics.prune = async function () {
  const count = await this.countDocuments();
  if (count > 500) {
    const oldest = await this.find().sort({ createdAt: -1 }).skip(500).limit(1);
    if (oldest.length) {
      await this.deleteMany({ createdAt: { $lte: oldest[0].createdAt } });
    }
  }
};

module.exports = mongoose.model('Activity', activitySchema);
