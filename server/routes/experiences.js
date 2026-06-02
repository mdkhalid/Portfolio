const Experience = require('../models/Experience');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, bool, int, strArray, mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED = ['role', 'company', 'location', 'startDate', 'endDate', 'current', 'bullets', 'order'];

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Experience.find().sort('order');
  res.json(items);
});

const sanitize = (body) => {
  const out = pick(body, ALLOWED);
  const strings = ['role', 'company', 'location', 'startDate', 'endDate'];
  for (const f of strings) {
    if (out[f] !== undefined) {
      out[f] = cleanPlain(str({ [f]: out[f] }, f, { min: 1, max: 500, optional: true }) || '');
    }
  }
  if (out.bullets !== undefined) out.bullets = strArray({ bullets: out.bullets }, 'bullets', { maxItems: 50, maxLen: 1000, optional: true });
  if (out.current !== undefined) out.current = bool({ current: out.current }, 'current');
  if (out.order !== undefined) out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
  return out;
};

exports.create = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.role || !data.company) throw new AppError('role and company are required', 400, 'MISSING_FIELDS');
  const item = await Experience.create(data);
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'experience id');
  const data = sanitize(req.body);
  const item = await Experience.findByIdAndUpdate(id, data, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'experience id');
  const item = await Experience.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
