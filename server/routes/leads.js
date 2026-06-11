const Lead = require('../models/Lead');
const ChatSession = require('../models/ChatSession');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, mongoId } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Lead.find().sort({ createdAt: -1 });
  const unreadCount = await Lead.countDocuments({ status: 'new' });
  res.json({ items, unreadCount });
});

exports.markStatus = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'lead id');
  const status = str(req.body, 'status', { min: 1, max: 20 });
  const valid = ['new', 'contacted', 'qualified', 'closed'];
  if (!valid.includes(status)) throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  const item = await Lead.findByIdAndUpdate(id, { status }, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.getChatMessages = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'session id');
  const session = await ChatSession.findById(id).select('messages');
  if (!session) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(session.messages);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'lead id');
  const item = await Lead.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
