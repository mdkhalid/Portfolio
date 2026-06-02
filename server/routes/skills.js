const Skill = require('../models/Skill');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, int, mongoId, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED = ['category', 'items', 'order'];

exports.getAll = asyncHandler(async (req, res) => {
  const skills = await Skill.find().sort('order');
  res.json(skills);
});

const sanitize = (body) => {
  const out = pick(body, ALLOWED);
  if (out.category !== undefined) out.category = cleanPlain(str({ category: out.category }, 'category', { min: 1, max: 100, optional: true }) || '');
  if (out.order !== undefined) out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
  if (out.items !== undefined) {
    if (!Array.isArray(out.items)) throw new AppError('items must be an array', 400, 'INVALID_TYPE');
    if (out.items.length > 200) throw new AppError('items has too many entries', 400, 'TOO_MANY_ITEMS');
    out.items = out.items.map((it, idx) => {
      if (!it || typeof it !== 'object') throw new AppError(`items[${idx}] must be an object`, 400, 'INVALID_TYPE');
      const name = cleanPlain(str({ name: it.name }, 'name', { min: 1, max: 100, optional: true }) || '');
      if (!name) throw new AppError(`items[${idx}].name is required`, 400, 'MISSING_FIELDS');
      const level = it.level === undefined ? 50 : int({ level: it.level }, 'level', { min: 0, max: 100 });
      return { name, level };
    });
  }
  return out;
};

exports.create = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.category) throw new AppError('category is required', 400, 'MISSING_FIELDS');
  const skill = await Skill.create(data);
  res.status(201).json(skill);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'skill id');
  const data = sanitize(req.body);
  const skill = await Skill.findByIdAndUpdate(id, data, { new: true });
  if (!skill) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(skill);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'skill id');
  const skill = await Skill.findByIdAndDelete(id);
  if (!skill) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
