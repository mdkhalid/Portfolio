const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  message: { type: String, default: '' },
  source: { type: String, default: 'chat' },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'closed'], default: 'new' },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1 });

module.exports = mongoose.model('Lead', leadSchema);
