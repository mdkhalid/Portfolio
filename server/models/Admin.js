const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
});

adminSchema.virtual('isLocked').get(function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
});

module.exports = mongoose.model('Admin', adminSchema);
