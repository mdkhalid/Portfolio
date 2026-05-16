const mongoose = require('mongoose');

const certificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuer: { type: String, default: '' },
  date: { type: String, default: '' },
  link: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Certification', certificationSchema);
