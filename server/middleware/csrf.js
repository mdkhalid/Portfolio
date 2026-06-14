const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf_token';
const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, CSRF_COOKIE_OPTIONS);
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, { ...CSRF_COOKIE_OPTIONS, maxAge: 0 });
}

const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
  }

  next();
};

const issueCsrfToken = (req, res) => {
  const token = req.cookies?.[CSRF_COOKIE] || generateToken();
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
};

module.exports = {
  csrfProtection,
  issueCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  CSRF_HEADER,
  CSRF_COOKIE,
};