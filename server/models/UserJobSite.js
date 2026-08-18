const mongoose = require('mongoose');

const userJobSiteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    name: { type: String, required: true, maxlength: 50 },
    // Custom (user-added) sites get a display label + base URL; built-ins use SITE_META.
    label: { type: String, default: '', maxlength: 100 },
    baseUrl: { type: String, default: '', maxlength: 500 },
    custom: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
    // Encrypted credentials / session data; never selected by default.
    credentials: { type: mongoose.Schema.Types.Mixed, select: false, default: null },
    // Encrypted paste-in cookie header string (browser session fallback for login).
    cookies: { type: String, select: false, default: null },
    cookieUpdatedAt: { type: Date, default: null },
    lastFetched: { type: Date, default: null },
    status: { type: String, enum: ['disconnected', 'connected', 'error'], default: 'disconnected' },
  },
  { timestamps: true }
);

userJobSiteSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('UserJobSite', userJobSiteSchema);
