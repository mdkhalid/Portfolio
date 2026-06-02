const Certification = require('../models/Certification');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, int, mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED = ['name', 'issuer', 'date', 'link', 'order'];

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Certification.find().sort('order');
  res.json(items);
});

const sanitize = (body) => {
  const out = pick(body, ALLOWED);
  const strings = ['name', 'issuer', 'date', 'link'];
  for (const f of strings) {
    if (out[f] !== undefined) {
      out[f] = cleanPlain(str({ [f]: out[f] }, f, { min: 1, max: 2000, optional: true }) || '');
    }
  }
  if (out.order !== undefined) out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
  return out;
};

exports.create = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.name) throw new AppError('name is required', 400, 'MISSING_FIELDS');
  const item = await Certification.create(data);
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'certification id');
  const data = sanitize(req.body);
  const item = await Certification.findByIdAndUpdate(id, data, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'certification id');
  const item = await Certification.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
