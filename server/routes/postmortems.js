const Postmortem = require('../models/Postmortem');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, int, bool, mongoId, strArray } = require('../middleware/validate');
const { clean, cleanPlain, slugify } = require('../middleware/sanitize');

const SEVERITY = new Set(['SEV1', 'SEV2', 'SEV3']);
const STATUS = new Set(['resolved', 'mitigated', 'monitoring', 'ongoing']);
const DETECTION = new Set([
  'pagerduty', 'customer_report', 'internal_monitoring', 'on_call', 'social_media', 'synthetic', 'other',
]);
const ACTION_STATUS = new Set(['todo', 'in_progress', 'done', 'wont_fix']);
const ACTION_PRIORITY = new Set(['P0', 'P1', 'P2', 'P3']);

const cleanShort = (body, key, { max = 500, optional = false } = {}) => {
  const v = str(body, key, { min: optional ? 0 : 1, max, optional });
  return v ? cleanPlain(v) : '';
};

const buildTimeline = (raw) => {
  if (raw === undefined || raw === null) return [];
  let arr = raw;
  if (typeof arr === 'string') {
    if (!arr.trim()) return [];
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) {
    throw new AppError('Field "timeline" must be an array', 400, 'INVALID_TYPE');
  }
  if (arr.length > 100) {
    throw new AppError('Field "timeline" has too many items (max 100)', 400, 'TOO_MANY_ITEMS');
  }
  return arr.map((it, i) => {
    if (!it || typeof it !== 'object') {
      throw new AppError(`timeline[${i}] must be an object`, 400, 'INVALID_TYPE');
    }
    const label = String(it.label || '').trim().slice(0, 200);
    if (!label) throw new AppError(`timeline[${i}].label is required`, 400, 'MISSING_FIELDS');
    return {
      time: String(it.time || '').trim().slice(0, 50),
      label: cleanPlain(label),
    };
  });
};

const buildActionItems = (raw) => {
  if (raw === undefined || raw === null) return [];
  let arr = raw;
  if (typeof arr === 'string') {
    if (!arr.trim()) return [];
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) {
    throw new AppError('Field "actionItems" must be an array', 400, 'INVALID_TYPE');
  }
  if (arr.length > 50) {
    throw new AppError('Field "actionItems" has too many items (max 50)', 400, 'TOO_MANY_ITEMS');
  }
  return arr.map((it, i) => {
    if (!it || typeof it !== 'object') {
      throw new AppError(`actionItems[${i}] must be an object`, 400, 'INVALID_TYPE');
    }
    const action = String(it.action || '').trim().slice(0, 500);
    if (!action) throw new AppError(`actionItems[${i}].action is required`, 400, 'MISSING_FIELDS');
    const status = String(it.status || 'todo');
    if (!ACTION_STATUS.has(status)) {
      throw new AppError(`actionItems[${i}].status is invalid`, 400, 'INVALID_TYPE');
    }
    const priority = String(it.priority || 'P1');
    if (!ACTION_PRIORITY.has(priority)) {
      throw new AppError(`actionItems[${i}].priority is invalid`, 400, 'INVALID_TYPE');
    }
    return {
      action: cleanPlain(action),
      owner: cleanPlain(String(it.owner || '').trim().slice(0, 100)),
      status,
      priority,
    };
  });
};

exports.getAll = asyncHandler(async (req, res) => {
  const limit = int(req.query, 'limit', { min: 1, max: 100, optional: true }) ?? 10;
  const skip = int(req.query, 'skip', { min: 0, max: 10000, optional: true }) ?? 0;
  const severity = req.query.severity ? String(req.query.severity).toUpperCase() : null;
  const status = req.query.status ? String(req.query.status).toLowerCase() : null;
  const tag = req.query.tag ? cleanPlain(str(req.query, 'tag', { min: 1, max: 50, optional: true })) : null;
  const search = req.query.q ? cleanPlain(str(req.query, 'q', { min: 1, max: 100, optional: true })) : null;

  const query = { published: true };
  if (severity && SEVERITY.has(severity)) query.severity = severity;
  if (status && STATUS.has(status)) query.status = status;
  if (tag) query.tags = tag;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: re }, { excerpt: re }, { customerImpact: re }];
  }

  const items = await Postmortem.find(query)
    .sort({ incidentDate: -1 })
    .skip(skip)
    .limit(limit)
    .select('-content');
  const total = await Postmortem.countDocuments(query);
  res.json({ items, total, hasMore: skip + limit < total });
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const slug = cleanPlain(str(req.params, 'slug', { min: 1, max: 200 }));
  const item = await Postmortem.findOne({ slug, published: true });
  if (!item) throw new AppError('Postmortem not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.getAllAdmin = asyncHandler(async (req, res) => {
  const items = await Postmortem.find().sort({ incidentDate: -1 }).select('-content');
  res.json(items);
});

exports.create = asyncHandler(async (req, res) => {
  const title = cleanPlain(str(req.body, 'title', { min: 1, max: 200 }));
  const content = req.body.content !== undefined
    ? clean(str(req.body, 'content', { min: 0, max: 200000, optional: true }) || '')
    : '';
  const excerpt = cleanShort(req.body, 'excerpt', { max: 500, optional: true });
  const rootCause = cleanShort(req.body, 'rootCause', { max: 2000, optional: true });
  const customerImpact = cleanShort(req.body, 'customerImpact', { max: 1000, optional: true });
  const coverImage = req.body.coverImage ? cleanPlain(str(req.body, 'coverImage', { min: 1, max: 2000 })) : '';

  const severity = String(req.body.severity || 'SEV3').toUpperCase();
  if (!SEVERITY.has(severity)) throw new AppError('Invalid severity', 400, 'INVALID_TYPE');

  const status = String(req.body.status || 'resolved').toLowerCase();
  if (!STATUS.has(status)) throw new AppError('Invalid status', 400, 'INVALID_TYPE');

  const detectionSource = String(req.body.detectionSource || 'internal_monitoring').toLowerCase();
  if (!DETECTION.has(detectionSource)) throw new AppError('Invalid detectionSource', 400, 'INVALID_TYPE');

  const incidentDate = req.body.incidentDate ? new Date(req.body.incidentDate) : new Date();
  if (isNaN(incidentDate.getTime())) throw new AppError('Invalid incidentDate', 400, 'INVALID_TYPE');
  const resolvedDate = req.body.resolvedDate ? new Date(req.body.resolvedDate) : null;
  if (resolvedDate && isNaN(resolvedDate.getTime())) {
    throw new AppError('Invalid resolvedDate', 400, 'INVALID_TYPE');
  }

  const durationMinutes = int(req.body, 'durationMinutes', { min: 0, max: 1_000_000, optional: true }) ?? 0;
  const published = bool(req.body, 'published', { optional: true }) ?? false;
  const tags = strArray(req.body, 'tags', { maxItems: 30, maxLen: 40, optional: true });
  const systemsAffected = strArray(req.body, 'systemsAffected', { maxItems: 30, maxLen: 100, optional: true });
  const contributingFactors = strArray(req.body, 'contributingFactors', { maxItems: 30, maxLen: 200, optional: true });
  const whatWentWell = strArray(req.body, 'whatWentWell', { maxItems: 30, maxLen: 300, optional: true });
  const whatDidntGoWell = strArray(req.body, 'whatDidntGoWell', { maxItems: 30, maxLen: 300, optional: true });
  const timeline = buildTimeline(req.body.timeline);
  const actionItems = buildActionItems(req.body.actionItems);

  const providedSlug = req.body.slug ? cleanPlain(str(req.body, 'slug', { min: 1, max: 200 })) : null;
  const slug = providedSlug || slugify(title);

  const item = await Postmortem.create({
    title, slug, content, excerpt, coverImage, tags, published,
    severity, status, incidentDate, resolvedDate, durationMinutes,
    systemsAffected, customerImpact, detectionSource, rootCause,
    contributingFactors, whatWentWell, whatDidntGoWell, timeline, actionItems,
  });
  res.status(201).json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'postmortem id');
  const updates = {};

  if (req.body.title !== undefined) updates.title = cleanPlain(str(req.body, 'title', { min: 1, max: 200 }));
  if (req.body.content !== undefined) {
    const v = req.body.content === null ? '' : (str(req.body, 'content', { min: 0, max: 200000, optional: true }) || '');
    updates.content = clean(v);
  }
  if (req.body.excerpt !== undefined) updates.excerpt = cleanShort(req.body, 'excerpt', { max: 500, optional: true });
  if (req.body.rootCause !== undefined) updates.rootCause = cleanShort(req.body, 'rootCause', { max: 2000, optional: true });
  if (req.body.customerImpact !== undefined) updates.customerImpact = cleanShort(req.body, 'customerImpact', { max: 1000, optional: true });
  if (req.body.coverImage !== undefined) updates.coverImage = cleanPlain(str(req.body, 'coverImage', { min: 1, max: 2000 }));

  if (req.body.severity !== undefined) {
    const s = String(req.body.severity).toUpperCase();
    if (!SEVERITY.has(s)) throw new AppError('Invalid severity', 400, 'INVALID_TYPE');
    updates.severity = s;
  }
  if (req.body.status !== undefined) {
    const s = String(req.body.status).toLowerCase();
    if (!STATUS.has(s)) throw new AppError('Invalid status', 400, 'INVALID_TYPE');
    updates.status = s;
  }
  if (req.body.detectionSource !== undefined) {
    const s = String(req.body.detectionSource).toLowerCase();
    if (!DETECTION.has(s)) throw new AppError('Invalid detectionSource', 400, 'INVALID_TYPE');
    updates.detectionSource = s;
  }
  if (req.body.incidentDate !== undefined) {
    const d = new Date(req.body.incidentDate);
    if (isNaN(d.getTime())) throw new AppError('Invalid incidentDate', 400, 'INVALID_TYPE');
    updates.incidentDate = d;
  }
  if (req.body.resolvedDate !== undefined) {
    if (req.body.resolvedDate === null) {
      updates.resolvedDate = null;
    } else {
      const d = new Date(req.body.resolvedDate);
      if (isNaN(d.getTime())) throw new AppError('Invalid resolvedDate', 400, 'INVALID_TYPE');
      updates.resolvedDate = d;
    }
  }
  if (req.body.durationMinutes !== undefined) updates.durationMinutes = int(req.body, 'durationMinutes', { min: 0, max: 1_000_000 });
  if (req.body.published !== undefined) updates.published = bool(req.body, 'published');
  if (req.body.tags !== undefined) updates.tags = strArray(req.body, 'tags', { maxItems: 30, maxLen: 40, optional: true });
  if (req.body.systemsAffected !== undefined) updates.systemsAffected = strArray(req.body, 'systemsAffected', { maxItems: 30, maxLen: 100, optional: true });
  if (req.body.contributingFactors !== undefined) updates.contributingFactors = strArray(req.body, 'contributingFactors', { maxItems: 30, maxLen: 200, optional: true });
  if (req.body.whatWentWell !== undefined) updates.whatWentWell = strArray(req.body, 'whatWentWell', { maxItems: 30, maxLen: 300, optional: true });
  if (req.body.whatDidntGoWell !== undefined) updates.whatDidntGoWell = strArray(req.body, 'whatDidntGoWell', { maxItems: 30, maxLen: 300, optional: true });
  if (req.body.timeline !== undefined) updates.timeline = buildTimeline(req.body.timeline);
  if (req.body.actionItems !== undefined) updates.actionItems = buildActionItems(req.body.actionItems);
  if (req.body.slug !== undefined) {
    updates.slug = cleanPlain(str(req.body, 'slug', { min: 1, max: 200 }));
  } else if (updates.title && !req.body.slug) {
    updates.slug = slugify(updates.title);
  }

  const item = await Postmortem.findByIdAndUpdate(id, updates, { new: true });
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'postmortem id');
  const item = await Postmortem.findByIdAndDelete(id);
  if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
  res.json({ message: 'Deleted' });
});
