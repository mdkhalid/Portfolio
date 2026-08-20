const express = require('express');
const UserJobSite = require('../models/UserJobSite');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, bool } = require('../middleware/validate');
const { encrypt, decrypt, maskValue } = require('../utils/credentials');
const { getAdapter, SITE_META, metaFor } = require('../adapters');
const validator = require('validator');

const router = express.Router();
const SITE_NAMES = Object.keys(SITE_META);

const toSafeSite = (doc) => {
  const plain = decrypt(doc.credentials);
  const meta = metaFor(doc.name, doc);
  return {
    id: doc._id,
    name: doc.name,
    label: meta.label || doc.label || doc.name,
    baseUrl: doc.baseUrl || meta.homeUrl || '',
    custom: Boolean(doc.custom) || !SITE_NAMES.includes(doc.name),
    enabled: doc.enabled,
    status: doc.status,
    lastFetched: doc.lastFetched,
    credentials: {
      email: plain?.email ? maskValue(plain.email) : '',
      // never expose password/secret
    },
    hasCookies: Boolean(doc.cookies),
    cookieUpdatedAt: doc.cookieUpdatedAt || null,
    createdAt: doc.createdAt,
  };
};

/** Confirm a name refers to a known site (built-in or an existing custom site). */
async function assertKnownSite(userId, name) {
  if (SITE_NAMES.includes(name)) return;
  const existing = await UserJobSite.findOne({ userId, name }).select('+credentials +cookies');
  if (!existing) throw new AppError('Unknown job site. Add it first (Add Site).', 400, 'INVALID_SITE');
}

/** Build a safe slug for custom site names. */
function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'custom-site';
}

router.get('/', asyncHandler(async (req, res) => {
  const docs = await UserJobSite.find({ userId: req.adminId }).select('+credentials +cookies').lean();
  const byName = Object.fromEntries(docs.map((d) => [d.name, d]));

  // Built-in sites are always listed (even before any config).
  const builtIn = SITE_NAMES.map((name) =>
    byName[name]
      ? toSafeSite(byName[name])
      : { name, label: SITE_META[name].label, baseUrl: SITE_META[name].homeUrl, custom: false, enabled: false, status: 'disconnected', credentials: { email: '' } }
  );

  // Custom sites stored in DB (not built-ins).
  const custom = docs
    .filter((d) => !SITE_NAMES.includes(d.name))
    .map(toSafeSite);

  res.json([...builtIn, ...custom]);
}));

/** POST / — add a custom site by URL. Body: { label, baseUrl }. */
router.post('/', asyncHandler(async (req, res) => {
  const label = str(req.body, 'label', { min: 2, max: 100 });
  const baseUrl = str(req.body, 'baseUrl', { min: 8, max: 500 });
  if (!validator.isURL(baseUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
    throw new AppError('baseUrl must be a valid http(s) URL', 400, 'INVALID_URL');
  }

  const name = slugify(label);
  if (SITE_NAMES.includes(name)) {
    throw new AppError(`"${name}" is already a built-in site`, 400, 'RESERVED_NAME');
  }
  const exists = await UserJobSite.findOne({ userId: req.adminId, name }).lean();
  if (exists) {
    throw new AppError('A site with this name already exists', 409, 'DUPLICATE_SITE');
  }

  const doc = await UserJobSite.create({
    userId: req.adminId,
    name,
    label,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    custom: true,
    enabled: false,
    status: 'disconnected',
  });
  res.status(201).json(toSafeSite(doc));
}));

/**
 * POST /login-all — try to connect EVERY configured site at once. Each site
 * logs in with its OWN stored credentials/session cookie (every connector has
 * a different login id + password). All logins run concurrently. When a site's
 * automated login hits a CAPTCHA/SSO/OTP/bot challenge, a visible browser
 * window opens automatically for that site — the user completes the login and
 * the session cookies are captured (enabling the site). A failure on one site
 * never blocks the others. Never touches a site that already has an interactive
 * login window open.
 */
router.post('/login-all', asyncHandler(async (req, res) => {
  const { isLoginInProgress, connectSite } = require('../services/browserLogin');
  const docs = await UserJobSite.find({ userId: req.adminId }).select('+credentials +cookies').lean();

  const targets = docs
    .map((doc) => {
      const creds = decrypt(doc.credentials) || {};
      const cookieHeader = doc.cookies ? decrypt(doc.cookies)?.value : null;
      const meta = metaFor(doc.name, doc);
      const origin = meta.homeUrl || doc.baseUrl;
      if (!origin) return null;
      return {
        name: doc.name,
        label: meta.label || doc.name,
        origin,
        email: creds.email,
        password: creds.password,
        cookieHeader,
        hasCreds: Boolean(cookieHeader || (creds.email && creds.password)),
      };
    })
    .filter(Boolean);

  const withCreds = targets.filter((t) => t.hasCreds);
  if (!withCreds.length) {
    throw new AppError('No sites have saved credentials or a session cookie to log in with — save them first', 400, 'MISSING_CREDENTIALS');
  }

  const results = await Promise.all(withCreds.map(async (t) => {
    // An interactive browser window is holding this site's profile — launching
    // another login on top of it would corrupt/steal the user's window.
    if (isLoginInProgress(t.name)) {
      return { name: t.name, label: t.label, ok: false, skipped: true, error: 'Interactive browser login already in progress for this site.' };
    }
    try {
      const r = await connectSite({
        site: t.name,
        email: t.email,
        password: t.password,
        cookieHeader: t.cookieHeader,
        origin: t.origin,
      });
      if (!r.ok) {
        await UserJobSite.updateOne({ userId: req.adminId, name: t.name }, { $set: { status: 'error' } });
        return { name: t.name, label: t.label, ok: false, status: 'error', error: r.reason || 'Connection failed', via: r.via };
      }
      // After any successful automated login (password or cookie), capture
      // fresh session cookies so the worker can reuse them. Set enabled: true
      // when we have stored credentials (cookie or password), not only when
      // new cookies are captured from an interactive browser fallback.
      const { captureCookiesFromContext } = require('../services/sessionRefresh');
      const updates = { status: 'connected' };
      if (r.cookieHeader) {
        // Interactive fallback earned a fresh session — persist the cookies so
        // the worker can reuse them, and enable the site like the per-site
        // "Login via Browser" button does.
        updates.cookies = encrypt({ value: r.cookieHeader });
        updates.cookieUpdatedAt = new Date();
      }
      // Set enabled: true whenever we have stored credentials (cookie OR password).
      // This ensures the site is active for auto-apply without requiring manual toggle.
      if (r.ok && (r.via === 'password' || r.via === 'cookies')) {
        updates.enabled = true;
      }
      // If we have a cookie header from interactive login, capture it into the
      // encrypted cookie store so future auto-apply runs can reuse the session.
      if (r.cookieHeader) {
        try {
          await captureCookiesFromContext(req.adminId, t.name).catch(() => {});
        } catch {}
      }
      await UserJobSite.updateOne({ userId: req.adminId, name: t.name }, { $set: updates });
      return { name: t.name, label: t.label, ok: true, status: 'connected', via: r.via };
    } catch (err) {
      await UserJobSite.updateOne({ userId: req.adminId, name: t.name }, { $set: { status: 'error' } });
      return { name: t.name, label: t.label, ok: false, status: 'error', error: err?.message || 'Connection failed' };
    }
  }));

  res.json({ ok: true, results });
}));

router.put('/:name', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 50 }).toLowerCase();
  await assertKnownSite(req.adminId, name);

  const emailRaw = str(req.body, 'email', { min: 3, max: 254, optional: true });
  const password = str(req.body, 'password', { min: 6, max: 200, optional: true });
  const enabled = bool(req.body, 'enabled', { optional: true });

  const existing = await UserJobSite.findOne({ userId: req.adminId, name }).select('+credentials +cookies');
  const prev = existing ? decrypt(existing.credentials) || {} : {};
  // A masked value (e.g. "jo***@gmail.com") is a display-only placeholder the
  // client must never send back, or it would overwrite the real credential.
  // Treat it as "keep existing".
  const email = emailRaw && !String(emailRaw).includes('*') ? emailRaw : (prev.email || emailRaw || '');
  const creds = {
    email: email !== undefined ? email : prev.email || '',
    password: password !== undefined ? password : prev.password || '',
  };
  const encrypted = encrypt(creds);

  let doc;
  if (existing) {
    existing.credentials = encrypted;
    if (enabled !== undefined) existing.enabled = enabled;
    doc = await existing.save();
  } else {
    doc = await UserJobSite.create({
      userId: req.adminId,
      name,
      credentials: encrypted,
      enabled: enabled !== undefined ? enabled : true,
      status: 'disconnected',
    });
  }
  res.json(toSafeSite(doc));
}));

router.put('/:name/cookies', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 50 }).toLowerCase();
  await assertKnownSite(req.adminId, name);

  const cookies = str(req.body, 'cookies', { min: 10, max: 20000, optional: true });
  const existing = await UserJobSite.findOne({ userId: req.adminId, name }).select('+cookies');

  if (cookies === undefined || cookies === '') {
    if (existing) {
      existing.cookies = null;
      existing.cookieUpdatedAt = null;
      await existing.save();
    }
    return res.json(toSafeSite(existing));
  }

  const encrypted = encrypt({ value: cookies });
  let doc;
  if (existing) {
    existing.cookies = encrypted;
    existing.cookieUpdatedAt = new Date();
    doc = await existing.save();
  } else {
    doc = await UserJobSite.create({
      userId: req.adminId,
      name,
      cookies: encrypted,
      cookieUpdatedAt: new Date(),
      status: 'disconnected',
    });
  }
  res.json(toSafeSite(doc));
}));

router.post('/:name/test', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 50 }).toLowerCase();
  await assertKnownSite(req.adminId, name);

  const doc = await UserJobSite.findOne({ userId: req.adminId, name }).select('+credentials +cookies');
  if (!doc) throw new AppError('Site not configured yet', 404, 'NOT_FOUND');
  const creds = decrypt(doc.credentials);
  const cookieHeader = doc.cookies ? decrypt(doc.cookies)?.value : null;
  if (!cookieHeader && (!creds?.email || !creds?.password)) {
    throw new AppError('Credentials or a session cookie are missing — save them first', 400, 'MISSING_CREDENTIALS');
  }

  const meta = metaFor(name, doc);
  const origin = meta.homeUrl;
  if (!origin) {
    throw new AppError('No site URL configured — set baseUrl when adding the site', 400, 'NO_SITE_URL');
  }

  try {
    const adapter = getAdapter(name);
    await adapter.login({
      email: creds.email,
      password: creds.password,
      cookies: cookieHeader || undefined,
      cookieOrigin: cookieHeader ? origin : undefined,
      baseUrl: origin,
    });
    doc.status = 'connected';
    await doc.save();
    res.json({ ok: true, status: 'connected', message: 'Connected successfully', via: cookieHeader ? 'cookies' : 'password' });
  } catch (err) {
    doc.status = 'error';
    await doc.save();
    res.status(400).json({ ok: false, status: 'error', error: err.message || 'Connection failed' });
  }
}));

/**
 * POST /:name/browser-login — assisted login: opens a visible Chrome window
 * on the site's login page, waits for the user to log in manually, then
 * captures the session cookies (encrypted), enables the site, and marks it
 * connected. No DevTools cookie pasting needed.
 */
router.post('/:name/browser-login', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 50 }).toLowerCase();
  await assertKnownSite(req.adminId, name);

  const { interactiveLogin } = require('../services/browserLogin');
  const result = await interactiveLogin(name);
  if (!result.ok) {
    throw new AppError(result.reason || 'Interactive login failed', 408, 'LOGIN_TIMEOUT');
  }

  const encrypted = encrypt({ value: result.cookieHeader });
  const existing = await UserJobSite.findOne({ userId: req.adminId, name }).select('+cookies +credentials');
  let doc;
  if (existing) {
    existing.cookies = encrypted;
    existing.cookieUpdatedAt = new Date();
    existing.enabled = true;
    existing.status = 'connected';
    doc = await existing.save();
  } else {
    doc = await UserJobSite.create({
      userId: req.adminId,
      name,
      cookies: encrypted,
      cookieUpdatedAt: new Date(),
      enabled: true,
      status: 'connected',
    });
  }
  res.json({ ...toSafeSite(doc), message: `Logged in — ${result.cookieCount} session cookies captured. Site enabled.` });
}));

router.delete('/:name', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 50 }).toLowerCase();
  await assertKnownSite(req.adminId, name);
  await UserJobSite.deleteOne({ userId: req.adminId, name });
  res.json({ message: 'Removed' });
}));

module.exports = router;
