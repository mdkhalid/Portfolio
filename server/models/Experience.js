const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  location: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, default: '' },
  current: { type: Boolean, default: false },
  bullets: [String],
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Experience', experienceSchema);
