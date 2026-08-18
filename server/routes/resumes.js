const Resume = require('../models/Resume');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getAll = asyncHandler(async (req, res) => {
  // Public list: the master resume is an internal ATS base document and is
  // never exposed on the client-facing site; others opt in via showOnSite.
  const items = await Resume.find({ isMaster: { $ne: true }, showOnSite: { $ne: false } }).sort('order');
  res.json(items);
});
