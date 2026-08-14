const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  fileUrl: { type: String, required: true },
  order: { type: Number, default: 0 },
  isMaster: { type: Boolean, default: false },
  showOnSite: { type: Boolean, default: true },
});

module.exports = mongoose.model('Resume', resumeSchema);
