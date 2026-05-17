const Message = require('../models/Message');

exports.getAll = async (req, res) => {
  const items = await Message.find().sort('-createdAt');
  res.json(items);
};

exports.markRead = async (req, res) => {
  const item = await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Message.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
