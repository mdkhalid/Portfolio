const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { int, mongoId, str, strArray } = require('../middleware/validate');
const SocialConnection = require('../models/SocialConnection');
const SocialPost = require('../models/SocialPost');
const { encryptToken } = require('../utils/cryptoSocial');
const linkedinService = require('../services/linkedinService');
const xService = require('../services/xService');
const {
  createState,
  verifyState,
  createPkcePair,
  resolveRedirectUri,
  popupResultHtml,
  STATE_COOKIE,
  STATE_MAX_AGE_MS,
} = require('../services/socialOauth');

const router = express.Router();

// OAuth connect/callback endpoints are public by design — browser redirects
// from LinkedIn/X carry no Authorization header. They are protected by
// HMAC-signed state + double-submit cookie instead of the admin JWT.
// Every other route below requires auth (+ CSRF for mutations).

const PLATFORMS = ['linkedin', 'x'];
const STATUS_VALUES = ['generating', 'draft', 'ready', 'failed'];
const SOCIAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'social');

/** Serve HTML with a scoped CSP override (popup pages use a tiny inline script). */
function sendHtml(res, status, html) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:"
  );
  res.status(status).type('html').send(html);
}

const stateCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: STATE_MAX_AGE_MS,
  path: '/api/social',
});

/** Public shape of a connection row (never exposes tokens). */
function connectionShape(row) {
  const rawStatus = row?.status || 'disconnected';
  const isExpired =
    row?.status === 'connected' && row?.expiresAt && new Date(row.expiresAt) < new Date();
  const status = isExpired ? 'expired' : rawStatus;
  if (!row || status !== 'connected') {
    return {
      connected: false,
      status,
      userName: row?.platformUserName || '',
      avatarUrl: '',
      connectedAt: null,
      expiresAt: null,
    };
  }
  return {
    connected: true,
    status,
    userName: row.platformUserName || '',
    avatarUrl: row.avatarUrl || '',
    connectedAt: row.connectedAt,
    expiresAt: row.expiresAt || null,
  };
}

async function saveConnection(platform, tokenData, profile) {
  const expiresInMs = Number(tokenData?.expires_in || 0) * 1000;
  const expiresAt = expiresInMs > 0 ? new Date(Date.now() + expiresInMs - 60_000) : null;
  const scope = Array.isArray(tokenData?.scope)
    ? tokenData.scope.join(' ')
    : String(tokenData?.scope || '');

  await SocialConnection.findOneAndUpdate(
    { platform },
    {
      platform,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      scope,
      platformUserId: profile?.id || '',
      platformUserName: profile?.username || profile?.name || '',
      avatarUrl: profile?.avatarUrl || '',
      status: 'connected',
      connectedAt: new Date(),
      disconnectedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** GET /linkedin/connect and /x/connect — start OAuth (public). */
function connectRoute(platform) {
  return (req, res) => {
    try {
      const service = platform === 'linkedin' ? linkedinService : xService;
      if (!service.isConfigured()) {
        return sendHtml(
          res,
          503,
          popupResultHtml(false, `${platform === 'x' ? 'X' : 'LinkedIn'} app is not configured yet. Add its client ID/secret to the server environment first.`)
        );
      }
      const redirectUri = resolveRedirectUri(req, platform);
      let authUrl;
      if (platform === 'linkedin') {
        const state = createState(platform);
        res.cookie(STATE_COOKIE, state, stateCookieOptions());
        authUrl = service.buildAuthUrl(redirectUri, state);
      } else {
        // PKCE verifier travels inside the HMAC-signed state payload.
        const { verifier } = createPkcePair();
        const state = createState(platform, { verifier });
        res.cookie(STATE_COOKIE, state, stateCookieOptions());
        authUrl = service.buildAuthUrl(redirectUri, state, verifier);
      }
      return res.redirect(authUrl);
    } catch (err) {
      console.error(`[social:${platform}-connect]`, err?.message || err);
      return sendHtml(res, 500, popupResultHtml(false, 'Could not start sign-in. Please try again.'));
    }
  };
}

router.get('/linkedin/connect', connectRoute('linkedin'));
router.get('/x/connect', connectRoute('x'));

/** Shared callback handler — validates state, exchanges code, stores tokens. */
async function handleCallback(req, res, platform) {
  const fail = (msg, status = 400) => sendHtml(res, status, popupResultHtml(false, msg));
  try {
    if (req.query.error) {
      return fail('Sign-in was cancelled or denied.');
    }
    const state = String(req.query.state || '');
    const payload = verifyState(state);
    const cookieState = String(req.cookies?.[STATE_COOKIE] || '');
    if (!payload || payload.platform !== platform || !cookieState || cookieState !== state) {
      return fail('Sign-in session expired or invalid. Please click Connect again.');
    }

    const code = String(req.query.code || '');
    if (!code) return fail('No authorization code received. Please retry.');

    res.clearCookie(STATE_COOKIE, { path: '/api/social' });
    const redirectUri = resolveRedirectUri(req, platform);

    if (platform === 'linkedin') {
      const tokens = await linkedinService.exchangeCodeForToken(code, redirectUri);
      const profile = await linkedinService.fetchProfile(tokens.access_token);
      await saveConnection(platform, tokens, profile);
    } else {
      const verifier = String(payload.verifier || '');
      if (!verifier) return fail('Invalid sign-in session. Please retry.');
      const tokens = await xService.exchangeCodeForToken(code, verifier, redirectUri);
      const profile = await xService.fetchProfile(tokens.access_token);
      await saveConnection(platform, tokens, profile);
    }
    return sendHtml(res, 200, popupResultHtml(true, `${platform === 'x' ? 'X' : 'LinkedIn'} connected successfully!`));
  } catch (err) {
    console.error(`[social:${platform}-callback]`, err?.message || err);
    return fail('Sign-in failed. Please reconnect.');
  }
}

router.get('/linkedin/callback', (req, res) => handleCallback(req, res, 'linkedin'));
router.get('/x/callback', (req, res) => handleCallback(req, res, 'x'));

/** POST /connections/:platform/disconnect — wipe stored tokens. */
router.post(
  '/connections/:platform/disconnect',
  auth,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const platform = req.params.platform;
    if (!PLATFORMS.includes(platform)) {
      throw new AppError('Unknown platform', 400, 'INVALID_PLATFORM');
    }
    await SocialConnection.updateOne(
      { platform },
      {
        $set: {
          status: 'disconnected',
          accessToken: null,
          refreshToken: null,
          connectedAt: null,
          disconnectedAt: new Date(),
        },
      }
    );
    res.json({ disconnected: true });
  })
);

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
      configured: {
        linkedin: linkedinService.isConfigured(),
        x: xService.isConfigured(),
      },
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

/* ── helpers defined after export for readability ─────────────────────────── */

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
