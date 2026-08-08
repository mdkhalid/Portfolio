const mongoose = require('mongoose');

const SITE_ENUM = ['naukri', 'indeed', 'linkedin'];

const userJobSiteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, enum: SITE_ENUM, required: true },
    enabled: { type: Boolean, default: false },
    // Encrypted credentials / session data; never selected by default.
    credentials: { type: mongoose.Schema.Types.Mixed, select: false, default: null },
    lastFetched: { type: Date, default: null },
    status: { type: String, enum: ['disconnected', 'connected', 'error'], default: 'disconnected' },
  },
  { timestamps: true }
);

userJobSiteSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('UserJobSite', userJobSiteSchema);
