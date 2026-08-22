const crypto = require('crypto');
const { socialFail } = require('../utils/socialErrors');

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const USERS_ME_URL = 'https://api.twitter.com/2/users/me';
const SCOPE = 'tweet.read tweet.write users.read offline.access';

function isConfigured() {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

/** Build the authorize URL for an existing PKCE verifier + signed state. */
function buildAuthUrl(redirectUri, state, verifier) {
  const v = verifier || crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(v).digest('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function fetchWithTimeout(url, options = {}, ms = 15000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString('base64');
}

async function tokenRequest(formParams) {
  try {
    const res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams(formParams),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(
        new Error(data?.error_description || data?.error || `X token error (${res.status})`),
        { response: { status: res.status, data } }
      );
    }
    return data;
  } catch (err) {
    socialFail('token_exchange', err, { status: 502 });
  }
}

/** Exchange authorization code for tokens (access ~2h + refresh token). */
async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  const data = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: process.env.X_CLIENT_ID || '',
  });
  if (!data.access_token) throw new Error('X token response missing access_token');
  return data;
}

/** Refresh an expired access token; rotates the refresh token. */
async function refreshAccessToken(refreshToken) {
  const data = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.X_CLIENT_ID || '',
  });
  if (!data.access_token) throw new Error('X refresh response missing access_token');
  return data;
}

/** Fetch account profile: id, name, username, avatar. Best-effort. */
async function fetchProfile(accessToken) {
  try {
    const res = await fetchWithTimeout(`${USERS_ME_URL}?user.fields=name,profile_image_url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const u = json?.data || {};
    return {
      id: u.id ? String(u.id) : '',
      name: u.name || '',
      username: u.username ? '@' + u.username : '',
      avatarUrl: (u.profile_image_url || '').replace('_normal', '_400x400'),
    };
  } catch {
    return null;
  }
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  fetchProfile,
  SCOPE,
};
