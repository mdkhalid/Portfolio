const Education = require('../models/Education');

exports.getAll = async (req, res) => {
  const items = await Education.find().sort('order');
  res.json(items);
};

exports.create = async (req, res) => {
  const item = await Education.create(req.body);
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  const item = await Education.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Education.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
