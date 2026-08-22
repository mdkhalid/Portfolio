const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { int, mongoId, str, strArray } = require('../middleware/validate');
const SocialConnection = require('../models/SocialConnection');
const SocialPost = require('../models/SocialPost');

const router = express.Router();

// OAuth connect/callback endpoints are added in Phase 1 and stay public here —
// browser redirects carry no Authorization header; those routes will be
// protected by a signed state parameter instead of the admin JWT.

const STATUS_VALUES = ['generating', 'draft', 'ready', 'failed'];
const SOCIAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'social');

/** Public shape of a connection row (never exposes tokens). */
function connectionShape(row) {
  if (!row || row.status !== 'connected') {
    return {
      connected: false,
      status: row?.status || 'disconnected',
      userName: '',
      avatarUrl: '',
      connectedAt: null,
      expiresAt: null,
    };
  }
  return {
    connected: true,
    status: 'connected',
    userName: row.platformUserName || '',
    avatarUrl: row.avatarUrl || '',
    connectedAt: row.connectedAt,
    expiresAt: row.expiresAt || null,
  };
}

async function getPostOr404(id) {
  mongoId(id, 'postId');
  const post = await SocialPost.findById(id).lean();
  if (!post) throw new AppError('Social post not found', 404, 'NOT_FOUND');
  return post;
}

/** Delete a generated image file, ignoring missing/invalid paths. */
function removeImageFile(imagePath) {
  try {
    if (!imagePath || !imagePath.startsWith('/uploads/social/')) return;
    const resolved = path.resolve(path.join(__dirname, '..', imagePath));
    if (!resolved.startsWith(path.resolve(SOCIAL_UPLOAD_DIR) + path.sep)) return;
    fs.promises.unlink(resolved).catch(() => {});
  } catch {
    // best-effort cleanup only
  }
}

/** GET /api/social/connections — connection status for both platforms. */
router.get(
  '/connections',
  auth,
  asyncHandler(async (req, res) => {
    const rows = await SocialConnection.find({})
      .select('platform status platformUserName avatarUrl connectedAt expiresAt')
      .lean();
    const byPlatform = Object.fromEntries(rows.map((r) => [r.platform, r]));
    res.json({
      linkedin: connectionShape(byPlatform.linkedin),
      x: connectionShape(byPlatform.x),
    });
  })
);

/** GET /api/social/posts?page=&limit=&status= — paginated history list. */
router.get(
  '/posts',
  auth,
  asyncHandler(async (req, res) => {
    const page = int(req.query, 'page', { min: 1, optional: true }) || 1;
    const limit = Math.min(int(req.query, 'limit', { min: 1, max: 100, optional: true }) || 20, 100);
    const status = str(req.query, 'status', { max: 20, optional: true });
    const filter = {};
    if (status) {
      if (!STATUS_VALUES.includes(status)) {
        throw new AppError(`Invalid status filter`, 400, 'INVALID_STATUS');
      }
      filter.status = status;
    }
    const [items, total] = await Promise.all([
      SocialPost.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          'title topicNotes status lastError imagePath linkedinCount xCount content.hook createdAt updatedAt'
        )
        .lean(),
      SocialPost.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

/** POST /api/social/posts — create draft from topic notes + start generation job.
 * Generation pipeline is wired in Phase 2; until then this returns 501. */
router.post(
  '/posts',
  auth,
  csrfProtection,
  asyncHandler(async (req, res) => {
    str(req.body, 'topicNotes', { max: 5000 });
    throw new AppError(
      'Social content generation is not implemented yet (Phase 2)',
      501,
      'NOT_IMPLEMENTED'
    );
  })
);

/** GET /api/social/posts/:id — full detail incl. publish log. */
router.get(
  '/posts/:id',
  auth,
  asyncHandler(async (req, res) => {
    res.json({ post: await getPostOr404(req.params.id) });
  })
);

/** PUT /api/social/posts/:id — save manual edits to text/prompts. */
router.put(
  '/posts/:id',
  auth,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const post = await SocialPost.findById(req.params.id);
    if (!post) throw new AppError('Social post not found', 404, 'NOT_FOUND');

    const updates = [
      ['title', { max: 300 }],
      ['contentPrompt', { max: 20000 }],
      ['imagePrompt', { max: 20000 }],
      ['xMessageTemplate', { max: 280 }],
    ];
    for (const [field, opts] of updates) {
      const v = str(req.body, field, { ...opts, optional: true });
      if (v !== undefined) post[field] = v;
    }

    if (req.body.content && typeof req.body.content === 'object') {
      for (const field of ['hook', 'body', 'fullText']) {
        const v = str(req.body.content, field, {
          max: field === 'body' || field === 'fullText' ? 3000 : 500,
          optional: true,
        });
        if (v !== undefined) post.content[field] = v;
      }
      const hashtags = strArray(req.body.content, 'hashtags', {
        maxItems: 30,
        maxLen: 60,
        optional: true,
      });
      if (req.body.content.hashtags !== undefined) post.content.hashtags = hashtags;
    }

    await post.save();
    res.json({ post: post.toObject() });
  })
);

/** DELETE /api/social/posts/:id */
router.delete(
  '/posts/:id',
  auth,
  csrfProtection,
  asyncHandler(async (req, res) => {
    mongoId(req.params.id, 'postId');
    const doc = await SocialPost.findById(req.params.id).select('imagePath').lean();
    if (!doc) throw new AppError('Social post not found', 404, 'NOT_FOUND');
    await SocialPost.deleteOne({ _id: req.params.id });
    removeImageFile(doc.imagePath);
    res.json({ deleted: true });
  })
);

/** Stub helper for endpoints delivered in later phases. */
function notImplemented(phase) {
  return asyncHandler(async () => {
    throw new AppError(`Not implemented yet (${phase})`, 501, 'NOT_IMPLEMENTED');
  });
}

router.post('/posts/:id/regenerate/text', auth, csrfProtection, notImplemented('Phase 2'));
router.post('/posts/:id/regenerate/image', auth, csrfProtection, notImplemented('Phase 2'));
router.post('/posts/:id/publish/linkedin', auth, csrfProtection, notImplemented('Phase 4'));
router.post('/posts/:id/publish/x', auth, csrfProtection, notImplemented('Phase 4'));

module.exports = router;
