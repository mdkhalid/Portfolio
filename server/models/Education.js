const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  field: { type: String, default: '' },
  institution: { type: String, required: true },
  location: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Education', educationSchema);
