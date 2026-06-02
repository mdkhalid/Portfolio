const Project = require('../models/Project');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, bool, int, strArray, mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED_FIELDS = [
  'name', 'role', 'description', 'location', 'startDate', 'endDate',
  'current', 'bullets', 'techStack', 'order', 'githubUrl', 'liveUrl', 'demoUrl', 'videoUrl',
];

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Project.find().sort('order');
  res.json(items);
});

const sanitize = (body) => {
  const out = pick(body, ALLOWED_FIELDS);
  const stringFields = ['name', 'role', 'description', 'location', 'startDate', 'endDate', 'githubUrl', 'liveUrl', 'demoUrl', 'videoUrl'];
  for (const f of stringFields) {
    if (out[f] !== undefined) {
      out[f] = cleanPlain(str({ [f]: out[f] }, f, { min: 1, max: 5000, optional: true }) || '');
    }
  }
  if (out.bullets !== undefined) out.bullets = strArray({ bullets: out.bullets }, 'bullets', { maxItems: 50, maxLen: 1000, optional: true });
  if (out.techStack !== undefined) out.techStack = strArray({ techStack: out.techStack }, 'techStack', { maxItems: 50, maxLen: 80, optional: true });
  if (out.current !== undefined) out.current = bool({ current: out.current }, 'current');
  if (out.order !== undefined) out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
  return out;
};

exports.create = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.name) throw new AppError('Project name is required', 400, 'MISSING_FIELDS');
  const item = await Project.create(data);
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'project id');
  const data = sanitize(req.body);
  const item = await Project.findByIdAndUpdate(id, data, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'project id');
  const item = await Project.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
