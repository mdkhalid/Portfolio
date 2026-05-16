const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  fileUrl: { type: String, required: true },
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Resume', resumeSchema);
