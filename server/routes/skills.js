const Skill = require('../models/Skill');

exports.getAll = async (req, res) => {
  const skills = await Skill.find().sort('order');
  res.json(skills);
};

exports.create = async (req, res) => {
  const skill = await Skill.create(req.body);
  res.status(201).json(skill);
};

exports.update = async (req, res) => {
  const skill = await Skill.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(skill);
};

exports.remove = async (req, res) => {
  await Skill.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
