const Article = require('../models/Article');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, bool, int, mongoId, strArray } = require('../middleware/validate');
const { clean, cleanPlain, slugify } = require('../middleware/sanitize');

exports.getAll = asyncHandler(async (req, res) => {
  const limit = int(req.query, 'limit', { min: 1, max: 100, optional: true }) ?? 10;
  const skip = int(req.query, 'skip', { min: 0, max: 10000, optional: true }) ?? 0;
  const tag = req.query.tag ? cleanPlain(str(req.query, 'tag', { min: 1, max: 50, optional: true })) : null;

  const query = { published: true };
  if (tag) query.tags = tag;

  const items = await Article.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-content');
  const total = await Article.countDocuments(query);
  res.json({ items, total, hasMore: skip + limit < total });
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const slug = cleanPlain(str(req.params, 'slug', { min: 1, max: 200 }));
  const item = await Article.findOne({ slug, published: true });
  if (!item) throw new AppError('Article not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.getAllAdmin = asyncHandler(async (req, res) => {
  const items = await Article.find().sort({ createdAt: -1 }).select('-content');
  res.json(items);
});

exports.create = asyncHandler(async (req, res) => {
  const title = cleanPlain(str(req.body, 'title', { min: 1, max: 200 }));
  const content = clean(str(req.body, 'content', { min: 1, max: 200000 }));
  const excerpt = req.body.excerpt ? cleanPlain(str(req.body, 'excerpt', { min: 1, max: 500 })) : '';
  const coverImage = req.body.coverImage ? cleanPlain(str(req.body, 'coverImage', { min: 1, max: 2000 })) : '';
  const tags = strArray(req.body, 'tags', { maxItems: 30, maxLen: 40, optional: true });
  const published = bool(req.body, 'published', { optional: true }) ?? false;
  const providedSlug = req.body.slug ? cleanPlain(str(req.body, 'slug', { min: 1, max: 200 })) : null;
  const slug = providedSlug || slugify(title);

  const item = await Article.create({ title, slug, content, excerpt, coverImage, tags, published });
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'article id');
  const updates = {};
  if (req.body.title !== undefined) updates.title = cleanPlain(str(req.body, 'title', { min: 1, max: 200 }));
  if (req.body.content !== undefined) updates.content = clean(str(req.body, 'content', { min: 1, max: 200000 }));
  if (req.body.excerpt !== undefined) updates.excerpt = cleanPlain(str(req.body, 'excerpt', { min: 1, max: 500 }));
  if (req.body.coverImage !== undefined) updates.coverImage = cleanPlain(str(req.body, 'coverImage', { min: 1, max: 2000 }));
  if (req.body.tags !== undefined) updates.tags = strArray(req.body, 'tags', { maxItems: 30, maxLen: 40, optional: true });
  if (req.body.published !== undefined) updates.published = bool(req.body, 'published');
  if (req.body.slug !== undefined) {
    updates.slug = cleanPlain(str(req.body, 'slug', { min: 1, max: 200 }));
  } else if (updates.title && !req.body.slug) {
    updates.slug = slugify(updates.title);
  }

  const item = await Article.findByIdAndUpdate(id, updates, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'article id');
  const item = await Article.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
