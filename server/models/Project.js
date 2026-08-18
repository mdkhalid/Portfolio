const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: '' },
  location: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  description: { type: String, default: '' },
  techStack: [String],
  bullets: [String],
  order: { type: Number, default: 0 },
  current: { type: Boolean, default: false },
  githubUrl: { type: String, default: '' },
  liveUrl: { type: String, default: '' },
  demoUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
});

module.exports = mongoose.model('Project', projectSchema);
