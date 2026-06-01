const Article = require('../models/Article');

exports.getAll = async (req, res) => {
  const { tag, limit = 10, skip = 0 } = req.query;
  const query = { published: true };
  if (tag) query.tags = tag;
  const items = await Article.find(query)
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .select('-content');
  const total = await Article.countDocuments(query);
  res.json({ items, total, hasMore: Number(skip) + Number(limit) < total });
};

exports.getBySlug = async (req, res) => {
  const item = await Article.findOne({ slug: req.params.slug, published: true });
  if (!item) return res.status(404).json({ error: 'Article not found' });
  res.json(item);
};

exports.getAllAdmin = async (req, res) => {
  const items = await Article.find().sort({ createdAt: -1 }).select('-content');
  res.json(items);
};

exports.create = async (req, res) => {
  const slug = req.body.slug || req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const item = await Article.create({ ...req.body, slug });
  res.status(201).json(item);
};

exports.update = async (req, res) => {
  const updates = { ...req.body };
  if (updates.title && !updates.slug) {
    updates.slug = updates.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  const item = await Article.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json(item);
};

exports.remove = async (req, res) => {
  await Article.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
};
