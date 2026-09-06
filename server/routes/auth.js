const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str } = require('../middleware/validate');
const { redactEmail } = require('../utils/security');
const Activity = require('../models/Activity');
const { authLimiter } = require('../middleware/rateLimiter');

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
};

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
}

function getJwtSecrets() {
  const current = process.env.JWT_SECRET;
  const previous = process.env.JWT_SECRET_PREVIOUS;
  return previous ? [current, previous] : [current];
}

function signJwt(admin) {
  const secrets = getJwtSecrets();
  return jwt.sign(
    { id: admin._id.toString(), tv: admin.tokenVersion || 0 },
    secrets[0],
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h', algorithm: 'HS256' }
  );
}

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const username = str(req.body, 'username', { min: 3, max: 32 });
    const password = str(req.body, 'password', { min: 8, max: 200 });

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      await bcrypt.compare(password, '$2a$10$invalidsaltinvalidsaltinvali');
      Activity.create({
        type: 'login_failed',
        description: 'Failed login (unknown user)',
        metadata: { username, ip: req.ip },
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (admin.isLocked) {
      const waitTime = Math.ceil((admin.lockedUntil - Date.now()) / 1000 / 60);
      Activity.create({
        type: 'login_failed',
        description: 'Login attempt on locked account',
        metadata: { username, ip: req.ip },
      }).catch(() => {});
      return res.status(429).json({ error: `Account locked. Try again in ${waitTime} minutes.` });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      admin.failedAttempts += 1;
      if (admin.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        admin.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await admin.save();
        Activity.create({
          type: 'account_locked',
          description: 'Account locked due to failed attempts',
          metadata: { username, ip: req.ip },
        }).catch(() => {});
        return res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
      }
      await admin.save();

      Activity.create({
        type: 'login_failed',
        description: 'Failed login (bad password)',
        metadata: { username, ip: req.ip, failedAttempts: admin.failedAttempts },
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (admin.failedAttempts > 0 || admin.lockedUntil) {
      admin.failedAttempts = 0;
      admin.lockedUntil = null;
      await admin.save();
    }

    const token = signJwt(admin);

    // Issue a long-lived refresh token (30d) in an httpOnly cookie so the
    // client can silently obtain a new short-lived JWT without re-login.
    const refresh = generateRefreshToken();
    admin.refreshTokenHash = hashToken(refresh);
    admin.refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await admin.save();
    setRefreshCookie(res, refresh);

    res.json({ token, username: admin.username });
  })
);

router.post(
  '/change-password',
  require('../middleware/auth'),
  require('../middleware/csrf').csrfProtection,
  asyncHandler(async (req, res) => {
    const currentPassword = str(req.body, 'currentPassword', { min: 8, max: 200 });
    const newPassword = str(req.body, 'newPassword', { min: 8, max: 200 });

    const admin = await Admin.findById(req.adminId);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const match = await bcrypt.compare(currentPassword, admin.password);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    admin.refreshTokenHash = null;
    admin.refreshTokenExpiry = null;
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    await admin.save();

    clearRefreshCookie(res);
    res.json({ message: 'Password changed. Please log in again.' });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const tokenHash = hashToken(token);
    const admin = await Admin.findOne({
      refreshTokenHash: tokenHash,
      refreshTokenExpiry: { $gt: new Date() },
    }).select('tokenVersion');

    if (!admin) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Rotate the refresh token on each use (single-use sliding window).
    const newRefresh = generateRefreshToken();
    admin.refreshTokenHash = hashToken(newRefresh);
    admin.refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await admin.save();
    setRefreshCookie(res, newRefresh);

    res.json({ token: signJwt(admin) });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const tokenHash = hashToken(token);
      await Admin.updateOne({ refreshTokenHash: tokenHash }, { $unset: { refreshTokenHash: 1, refreshTokenExpiry: 1 } });
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
  })
);

module.exports = router;
