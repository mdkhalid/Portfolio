const Resume = require('../models/Resume');

exports.getAll = async (req, res) => {
  const items = await Resume.find().sort('order');
  res.json(items);
};
