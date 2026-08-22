const mongoose = require('mongoose');

const PLATFORMS = ['linkedin', 'x'];

const socialConnectionSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORMS, required: true },
    // Encrypted OAuth tokens; never selected by default.
    accessToken: { type: String, select: false, default: null },
    refreshToken: { type: String, select: false, default: null },
    expiresAt: { type: Date, default: null },
    scope: { type: String, default: '', maxlength: 500 },
    platformUserId: { type: String, default: '', maxlength: 200 },
    platformUserName: { type: String, default: '', maxlength: 200 },
    avatarUrl: { type: String, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ['disconnected', 'connected', 'expired'],
      default: 'disconnected',
    },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One connection row per platform (single-admin app).
socialConnectionSchema.index({ platform: 1 }, { unique: true });

module.exports = mongoose.model('SocialConnection', socialConnectionSchema);
module.exports.PLATFORMS = PLATFORMS;
