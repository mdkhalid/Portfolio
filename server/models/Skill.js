const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  category: { type: String, required: true },
  items: [{ name: String, level: { type: Number, min: 0, max: 100 } }],
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Skill', skillSchema);
