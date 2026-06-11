const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['visitor', 'admin', 'system'], required: true },
  name: { type: String, default: '' },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const chatSessionSchema = new mongoose.Schema({
  visitorId: { type: String, required: true },
  visitorName: { type: String, default: 'Guest' },
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting',
  },
  queuePosition: { type: Number, default: 0 },
  messages: [messageSchema],
  assignedAdmin: { type: String, default: '' },
  socketId: { type: String, default: '' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

chatSessionSchema.index({ status: 1, createdAt: 1 });
chatSessionSchema.index({ visitorId: 1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
