const Education = require('../models/Education');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, int, mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED = ['degree', 'field', 'institution', 'location', 'startDate', 'endDate', 'order'];

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Education.find().sort('order');
  res.json(items);
});

const sanitize = (body) => {
  const out = pick(body, ALLOWED);
  const strings = ['degree', 'field', 'institution', 'location', 'startDate', 'endDate'];
  for (const f of strings) {
    if (out[f] !== undefined) {
      out[f] = cleanPlain(str({ [f]: out[f] }, f, { min: 1, max: 500, optional: true }) || '');
    }
  }
  if (out.order !== undefined) out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
  return out;
};

exports.create = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.degree || !data.institution) throw new AppError('degree and institution are required', 400, 'MISSING_FIELDS');
  const item = await Education.create(data);
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'education id');
  const data = sanitize(req.body);
  const item = await Education.findByIdAndUpdate(id, data, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'education id');
  const item = await Education.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
