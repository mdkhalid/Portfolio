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

const REGISTER_UPLOAD_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload';
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';

/** LinkedIn person URN from the OIDC subject we stored at connect time. */
function personUrn(platformUserId) {
  return `urn:li:person:${platformUserId}`;
}

/**
 * Step 1 of publishing with an image: ask LinkedIn for a dedicated asset URN
 * and a single-use upload URL. Returns { asset, uploadUrl, uploadHeaders }.
 */
async function registerImageUpload(accessToken, platformUserId) {
  try {
    const owner = personUrn(platformUserId);
    const res = await fetchWithTimeout(REGISTER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner,
          serviceRelationships: [
            { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
          ],
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(
        new Error(data?.message || `LinkedIn registerUpload error (${res.status})`),
        { response: { status: res.status, data } }
      );
    }
    const mechanism =
      data?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
    const uploadUrl = mechanism?.uploadUrl;
    if (!uploadUrl || !data?.value?.asset) {
      throw new Error('LinkedIn registerUpload response missing asset/uploadUrl');
    }
    return { asset: data.value.asset, uploadUrl, uploadHeaders: mechanism.headers || {} };
  } catch (err) {
    socialFail('publish_linkedin', err, { status: 502 });
  }
}

/** Step 2: PUT the raw image bytes to the single-use upload URL. */
async function uploadImageBinary(accessToken, uploadUrl, buffer, contentType = 'application/octet-stream') {
  try {
    const res = await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw Object.assign(new Error(`LinkedIn image upload failed (${res.status})`), {
        response: { status: res.status, data: txt },
      });
    }
  } catch (err) {
    socialFail('publish_linkedin', err, { status: 502 });
  }
}

/** Resolve the public activity URN for a freshly created ugcPost (for the URL). */
async function fetchActivityUrn(accessToken, ugcPostUrn) {
  try {
    const encoded = encodeURIComponent(ugcPostUrn);
    const res = await fetchWithTimeout(`${UGC_POSTS_URL}/${encoded}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const act = data?.activities?.[0];
    return act ? String(act) : null;
  } catch {
    return null;
  }
}

/**
 * Step 3: create a PUBLISHED UGC post. Returns { id, url, platformPostId }.
 * `imageAssetUrn` is optional — text-only posts are allowed.
 */
async function createPost(accessToken, platformUserId, { text, imageAssetUrn } = {}) {
  try {
    const author = personUrn(platformUserId);
    const hasImage = Boolean(imageAssetUrn);
    const body = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text || '' },
          shareMediaCategory: hasImage ? 'IMAGE' : 'NONE',
          media: hasImage
            ? [{ status: 'READY', media: imageAssetUrn, title: { text: (text || '').slice(0, 200) } }]
            : [],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
    const res = await fetchWithTimeout(UGC_POSTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(
        new Error(data?.message || `LinkedIn create post error (${res.status})`),
        { response: { status: res.status, data } }
      );
    }
    const ugcPostUrn = data?.id || res.headers.get('x-restli-id') || '';
    const activityUrn = await fetchActivityUrn(accessToken, ugcPostUrn);
    const url = activityUrn
      ? `https://www.linkedin.com/feed/update/${activityUrn}`
      : `https://www.linkedin.com/feed/update/${ugcPostUrn}`;
    const platformPostId = ugcPostUrn.replace('urn:li:ugcPost:', '');
    return { id: ugcPostUrn, url, platformPostId };
  } catch (err) {
    socialFail('publish_linkedin', err, { status: 502 });
  }
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  fetchProfile,
  SCOPE,
  personUrn,
  registerImageUpload,
  uploadImageBinary,
  createPost,
};
