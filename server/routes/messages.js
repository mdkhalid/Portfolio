const Message = require('../models/Message');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED = ['name', 'email', 'subject', 'message', 'read'];

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Message.find().sort('-createdAt');
  res.json(items);
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'message id');
  const item = await Message.findByIdAndUpdate(id, { read: true }, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'message id');
  const item = await Message.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
