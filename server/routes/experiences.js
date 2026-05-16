const Experience = require('../models/Experience');

exports.getAll = async (req, res) => {
  const items = await Experience.find().sort('order');
  res.json(items);
};

exports.create = async (req, res) => {
  const item = await Experience.create(req.body);
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  const item = await Experience.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Experience.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
