const Activity = require('../models/Activity');

exports.getRecent = async (req, res) => {
  try {
    const items = await Activity.find().sort({ createdAt: -1 }).limit(30);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
