const mongoose = require('mongoose');

/**
 * In-app + email notification record for pipeline/apply events.
 * Also doubles as the queue for the daily email digest
 * (digestPending until sent, then emailDelivered).
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    type: {
      type: String,
      enum: [
        'batch_complete',
        'apply_success',
        'apply_failed',
        'needs_input',
        'pipeline_paused',
        'pipeline_resumed',
        'ai_budget',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 1000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: '' },
    read: { type: Boolean, default: false },
    emailDelivered: { type: Boolean, default: false },
    digestPending: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string', $ne: '' } } });

module.exports = mongoose.model('Notification', notificationSchema);
