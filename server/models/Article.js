const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String, default: '' },
  tags: [{ type: String }],
  coverImage: { type: String, default: '' },
  published: { type: Boolean, default: false },
  readingTime: { type: Number, default: 0 },
}, { timestamps: true });

articleSchema.pre('save', function(next) {
  if (this.isModified('content') || this.isNew) {
    const wordsPerMinute = 200;
    const words = this.content.trim().split(/\s+/).length;
    this.readingTime = Math.ceil(words / wordsPerMinute);
  }
  next();
});

module.exports = mongoose.model('Article', articleSchema);
