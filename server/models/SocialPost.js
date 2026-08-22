const mongoose = require('mongoose');

/** One publish attempt against a platform (success or failure). */
const publishEntrySchema = new mongoose.Schema(
  {
    platform: { type: String, enum: ['linkedin', 'x'], required: true },
    url: { type: String, default: '', maxlength: 1000 },
    platformPostId: { type: String, default: '', maxlength: 200 },
    ok: { type: Boolean, required: true },
    error: { type: String, default: '', maxlength: 2000 },
    postedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const socialPostSchema = new mongoose.Schema(
  {
    // Short human label derived at generation time; shown in history lists.
    title: { type: String, default: '', maxlength: 300 },
    // Admin's raw few lines of input.
    topicNotes: { type: String, required: true, maxlength: 5000 },
    // Prompts are built by the app first, then used for generation.
    contentPrompt: { type: String, default: '', maxlength: 20000 },
    imagePrompt: { type: String, default: '', maxlength: 20000 },
    // Generated LinkedIn post content.
    content: {
      hook: { type: String, default: '', maxlength: 500 },
      body: { type: String, default: '', maxlength: 3000 },
      hashtags: { type: [String], default: [] },
      fullText: { type: String, default: '', maxlength: 3000 },
    },
    // Short teaser posted to X (LinkedIn URL appended at send time).
    xMessageTemplate: { type: String, default: '', maxlength: 280 },
    imagePath: { type: String, default: '' }, // '/uploads/social/<file>.<ext>'
    status: {
      type: String,
      enum: ['generating', 'draft', 'ready', 'failed'],
      default: 'generating',
      index: true,
    },
    lastError: { type: String, default: '', maxlength: 2000 },
    // Successful-publish counters only — incremented after verified success.
    linkedinCount: { type: Number, default: 0, min: 0 },
    xCount: { type: Number, default: 0, min: 0 },
    publishes: { type: [publishEntrySchema], default: [] },
  },
  { timestamps: true }
);

// History list pagination + common filters.
socialPostSchema.index({ createdAt: -1 });
socialPostSchema.index({ status: 1, createdAt: -1 });
socialPostSchema.index({ linkedinCount: -1 });

module.exports = mongoose.model('SocialPost', socialPostSchema);
