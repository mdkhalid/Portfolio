const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String, default: '' },
  tags: [{ type: String }],
  coverImage: { type: String, default: '' },
  published: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Article', articleSchema);
