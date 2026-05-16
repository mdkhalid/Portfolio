const Certification = require('../models/Certification');

exports.getAll = async (req, res) => {
  const items = await Certification.find().sort('order');
  res.json(items);
};

exports.create = async (req, res) => {
  const item = await Certification.create(req.body);
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  const item = await Certification.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Certification.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
