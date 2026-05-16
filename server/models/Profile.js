const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: { type: String, default: 'Mohammad Khalid' },
  email: { type: String, default: 'khalid_bib@yahoo.com' },
  phone: { type: String, default: '9811291878' },
  location: { type: String, default: 'Delhi, India' },
  linkedIn: { type: String, default: '' },
  github: { type: String, default: '' },
  title: { type: String, default: 'Senior Solution Architect' },
  summary: { type: String, default: '' },
  avatar: { type: String, default: '' },
  experienceYears: { type: Number, default: 18 },
});

module.exports = mongoose.model('Profile', profileSchema);
