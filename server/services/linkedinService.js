const { socialFail } = require('../utils/socialErrors');

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPE = 'openid profile email w_member_social';

function isConfigured() {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: SCOPE,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function fetchWithTimeout(url, options = {}, ms = 15000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
}

/** Exchange the OAuth code for an access token (60-day member token). */
async function exchangeCodeForToken(code, redirectUri) {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    });
    const res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.error_description || data?.error || `LinkedIn token error (${res.status})`), { response: { status: res.status, data } });
    }
    if (!data.access_token) throw new Error('LinkedIn token response missing access_token');
    return data;
  } catch (err) {
    socialFail('token_exchange', err, { status: 502 });
  }
}

/** Fetch OIDC profile: sub, name, email, picture. Best-effort — never throws hard. */
async function fetchProfile(accessToken) {
  try {
    const res = await fetchWithTimeout(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const p = await res.json();
    return {
      id: p.sub ? String(p.sub) : '',
      name: p.name || '',
      email: p.email || '',
      avatarUrl: p.picture || '',
    };
  } catch {
    return null;
  }
}

module.exports = { isConfigured, buildAuthUrl, exchangeCodeForToken, fetchProfile, SCOPE };
