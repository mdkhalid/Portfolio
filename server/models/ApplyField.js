const mongoose = require('mongoose');

const FIELD_TYPE = ['text', 'textarea', 'select', 'radio', 'email', 'tel', 'number', 'url', 'date'];
const VALUE_SOURCE = ['saved', 'profile', 'ai', 'ai_fewshot', 'user', 'manual'];

/**
 * Knowledge base of apply-form fields the pipeline has seen, keyed by
 * (userId, site, key). Values learned from past applications (or entered by
 * the user) are reused automatically on future applications so bulk runs stay
 * fully automatic instead of re-pausing for the same information.
 */
const applyFieldSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    site: { type: String, default: 'global' },
    key: { type: String, required: true }, // normalized field key, e.g. 'years_of_experience'
    canonicalKey: { type: String, default: '', index: true }, // semantic concept e.g. 'notice_period', 'sponsorship'
    label: { type: String, default: '' },
    type: { type: String, enum: FIELD_TYPE, default: 'text' },
    selector: { type: String, default: '' },
    options: [{ type: String }],
    value: { type: String, default: '' },
    source: { type: String, enum: VALUE_SOURCE, default: 'ai' },
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Learned field per user + site + key.
applyFieldSchema.index({ userId: 1, site: 1, key: 1 });
applyFieldSchema.index({ userId: 1, canonicalKey: 1 });

module.exports = mongoose.model('ApplyField', applyFieldSchema);
