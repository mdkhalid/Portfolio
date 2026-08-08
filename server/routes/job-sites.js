const express = require('express');
const UserJobSite = require('../models/UserJobSite');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, bool } = require('../middleware/validate');
const { encrypt, decrypt, maskValue } = require('../utils/credentials');
const { getAdapter, SITE_META } = require('../adapters');

const router = express.Router();
const SITE_NAMES = Object.keys(SITE_META);

const toSafeSite = (doc) => {
  const plain = decrypt(doc.credentials);
  return {
    id: doc._id,
    name: doc.name,
    label: SITE_META[doc.name]?.label || doc.name,
    enabled: doc.enabled,
    status: doc.status,
    lastFetched: doc.lastFetched,
    credentials: {
      email: plain?.email ? maskValue(plain.email) : '',
      // never expose password/secret
    },
    createdAt: doc.createdAt,
  };
};

router.get('/', asyncHandler(async (req, res) => {
  const docs = await UserJobSite.find({ userId: req.adminId }).select('+credentials').lean();
  const byName = Object.fromEntries(docs.map((d) => [d.name, d]));
  const merged = SITE_NAMES.map((name) =>
    byName[name]
      ? toSafeSite(byName[name])
      : { name, label: SITE_META[name].label, enabled: false, status: 'disconnected', credentials: { email: '' } }
  );
  res.json(merged);
}));

router.put('/:name', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 30 }).toLowerCase();
  if (!SITE_NAMES.includes(name)) throw new AppError('Unsupported job site', 400, 'INVALID_SITE');

  const email = str(req.body, 'email', { min: 3, max: 254, optional: true });
  const password = str(req.body, 'password', { min: 6, max: 200, optional: true });
  const enabled = bool(req.body, 'enabled', { optional: true });

  const existing = await UserJobSite.findOne({ userId: req.adminId, name }).select('+credentials');
  const prev = existing ? decrypt(existing.credentials) || {} : {};
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

router.post('/:name/test', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 30 }).toLowerCase();
  if (!SITE_NAMES.includes(name)) throw new AppError('Unsupported job site', 400, 'INVALID_SITE');

  const doc = await UserJobSite.findOne({ userId: req.adminId, name }).select('+credentials');
  if (!doc) throw new AppError('Site not configured yet', 404, 'NOT_FOUND');
  const creds = decrypt(doc.credentials);
  if (!creds?.email || !creds?.password) {
    throw new AppError('Credentials missing — save them first', 400, 'MISSING_CREDENTIALS');
  }

  try {
    const adapter = getAdapter(name);
    await adapter.login({ email: creds.email, password: creds.password });
    doc.status = 'connected';
    await doc.save();
    res.json({ ok: true, status: 'connected', message: 'Connected successfully' });
  } catch (err) {
    doc.status = 'error';
    await doc.save();
    res.status(400).json({ ok: false, status: 'error', error: err.message || 'Connection failed' });
  }
}));

router.delete('/:name', asyncHandler(async (req, res) => {
  const name = str(req.params, 'name', { min: 1, max: 30 }).toLowerCase();
  if (!SITE_NAMES.includes(name)) throw new AppError('Unsupported job site', 400, 'INVALID_SITE');
  await UserJobSite.deleteOne({ userId: req.adminId, name });
  res.json({ message: 'Removed' });
}));

module.exports = router;
