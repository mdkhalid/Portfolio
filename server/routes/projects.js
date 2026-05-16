const Project = require('../models/Project');

exports.getAll = async (req, res) => {
  const items = await Project.find().sort('order');
  res.json(items);
};

exports.create = async (req, res) => {
  const item = await Project.create(req.body);
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  const item = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Project.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
