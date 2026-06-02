const Activity = require('../models/Activity');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getRecent = asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
  const items = await Activity.find().sort({ createdAt: -1 }).limit(limit);
  res.json(items);
});
