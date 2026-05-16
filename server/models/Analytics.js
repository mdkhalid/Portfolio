const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  pageViews: { type: Number, default: 0 },
  uniqueIPs: [String],
});

module.exports = mongoose.model('Analytics', analyticsSchema);
