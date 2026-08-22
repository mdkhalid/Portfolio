const crypto = require('crypto');

/**
 * Shared OAuth helpers for the Social Publisher:
 *  - HMAC-signed state values (CSRF protection for connect/callback flows)
 *  - PKCE pair generation for X OAuth 2.0
 *  - Redirect URI resolution with env overrides
 */

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const STATE_COOKIE = 'social_oauth_state';

function signingSecret() {
  const secret = process.env.JWT_SECRET || process.env.SOCIAL_CREDENTIALS_KEY;
  if (!secret) throw new Error('No signing secret available for OAuth state');
  return crypto.createHash('sha256').update(secret).digest();
}

function hmac(payload) {
  return crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

/** Build a signed state value: <base64 payload>.<hmac> */
function createState(platform, extra = {}) {
  const payload = Buffer.from(
    JSON.stringify({ platform, ts: Date.now(), ...extra })
  ).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

/** Verify a signed state; returns parsed payload or null (never throws). */
function verifyState(state) {
  try {
    if (!state || typeof state !== 'string') return null;
    const dot = state.lastIndexOf('.');
    if (dot <= 0) return null;
    const payloadB64 = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = hmac(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!data?.platform || !data?.ts) return null;
    if (Date.now() - Number(data.ts) > STATE_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/** PKCE S256 pair for X OAuth. */
function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Resolve the public callback URL for a platform.
 * Priority: explicit LINKEDIN_REDIRECT_URI / X_REDIRECT_URI →
 * SERVER_BASE_URL + path → request-derived URL.
 */
function resolveRedirectUri(req, platform) {
  const path = `/api/social/${platform}/callback`;
  if (platform === 'linkedin' && process.env.LINKEDIN_REDIRECT_URI) {
    return process.env.LINKEDIN_REDIRECT_URI.trim();
  }
  if (platform === 'x' && process.env.X_REDIRECT_URI) {
    return process.env.X_REDIRECT_URI.trim();
  }
  if (process.env.SERVER_BASE_URL) {
    return process.env.SERVER_BASE_URL.replace(/\/+$/, '') + path;
  }
  // Last resort: derive from the incoming request.
  const proto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim()
    || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = req.headers['x-forwarded-host']?.split(',')[0]?.trim()
    || req.headers.host
    || 'localhost';
  return `${proto}://${host}${path}`;
}

/** Minimal HTML page that notifies the opener and closes the popup. */
function popupResultHtml(ok, message) {
  const safeMsg = String(message || '').replace(/[<>&"]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Connect account</title></head>` +
    `<body style="font-family:system-ui,sans-serif;text-align:center;padding-top:48px;background:#0f172a;color:#e2e8f0">` +
    `<p style="font-size:16px">${ok ? '&#10003;' : '&#9888;'} ${safeMsg}</p>` +
    `<p style="opacity:.6;font-size:13px">You can close this window.</p>` +
    `<script>try{if(window.opener){window.opener.postMessage({source:'social_oauth',ok:${!!ok}},'*')}}catch(e){};setTimeout(function(){window.close()},900)</script>` +
    `</body></html>`;
}

module.exports = {
  STATE_COOKIE,
  STATE_MAX_AGE_MS,
  createState,
  verifyState,
  createPkcePair,
  resolveRedirectUri,
  popupResultHtml,
};
