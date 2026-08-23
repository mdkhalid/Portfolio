const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getQueue } = require('./index');

/**
 * Social Publisher queue jobs + live progress events.
 * Producers are used by /api/social routes; processors self-register on the
 * shared applyQueue (Bull or in-memory fallback) before the first enqueue.
 */

const JOB = {
  GENERATE: 'social_generate',
  PUBLISH_LINKEDIN: 'social_publish_linkedin',
  PUBLISH_X: 'social_publish_x',
};

// Generation pipeline steps (drives the client's animated progress UI).
const GENERATION_STEPS = [
  { key: 'building_prompts', label: 'Building prompts' },
  { key: 'writing_content', label: 'Writing post content' },
  { key: 'creating_image', label: 'Creating image' },
  { key: 'saving_draft', label: 'Saving draft' },
];

// Publish pipeline steps per platform.
const PUBLISH_STEPS = {
  linkedin: [
    { key: 'preparing_upload', label: 'Preparing image upload' },
    { key: 'uploading_image', label: 'Uploading image' },
    { key: 'creating_post', label: 'Creating LinkedIn post' },
    { key: 'verifying', label: 'Verifying publish' },
  ],
  x: [
    { key: 'composing_tweet', label: 'Composing tweet' },
    { key: 'posting_tweet', label: 'Posting to X' },
    { key: 'verifying', label: 'Verifying publish' },
  ],
};

// Image file extension → MIME type (LinkedIn upload negotiation).
const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function safePublishMessage(err) {
  if (err?.expose && err.message) return String(err.message).slice(0, 2000);
  return 'Publishing failed. Nothing was posted — you can safely retry.';
}

let _io = null;
let _registered = false;

/** Register the live Socket.io instance (wired from server.js setupSocket). */
function setSocialIO(io) {
  _io = io;
}

/**
 * Emit a progress event for one SocialPost to the admin room.
 * payload: { status: 'active'|'done'|'error', label?, error?, result? }
 */
function emitSocialProgress(postId, step, payload = {}) {
  if (!_io) return;
  _io.to('admin-room').emit('social:progress', {
    postId: String(postId),
    step,
    ...payload,
  });
}

async function enqueueSocialJob(name, data, opts = {}) {
  const queue = await getQueue();
  return queue.add(name, data, {
    attempts: opts.attempts ?? 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
    jobId: opts.jobId,
  });
}

/* ── Generation pipeline ──────────────────────────────────────────────────── */

const SOCIAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'social');

function safeMessage(err) {
  if (err?.expose && err.message) return String(err.message).slice(0, 2000);
  return 'Generation failed unexpectedly. Please try again.';
}

async function processGenerateJob(job) {
  const SocialPost = require('../models/SocialPost'); // lazy: avoid import cycles
  const socialAi = require('../services/socialAi');
  const { emitSocialProgress } = module.exports;

  const postId = String(job.data?.postId || '');
  const only = job.data?.only || null; // 'text' | 'image' | null (= full)
  const post = await SocialPost.findById(postId);
  if (!post) return;

  let currentKey = 'building_prompts';
  const step = async (key, status, extra = {}) => {
    if (status === 'active') currentKey = key;
    return emitSocialProgress(postId, key, { status, ...extra });
  };

  try {
    // 1. Build both prompts first — always persisted for visibility/editing.
    if (only !== 'image') {
      await step('building_prompts', 'active', { label: 'Building prompts' });
      post.contentPrompt = post.contentPrompt || socialAi.buildContentPrompt(post.topicNotes);
      post.imagePrompt = post.imagePrompt || socialAi.buildImagePrompt(post.topicNotes);
      await post.save().catch(() => {});
      await step('building_prompts', 'done');
    }

    // 2. Generate the LinkedIn post content.
    if (only !== 'image') {
      await step('writing_content', 'active', { label: 'Writing post content' });
      const cfg = socialAi.requireConfig('content');
      const gen = await socialAi.generateContent(cfg, post.contentPrompt);
      post.title = gen.title;
      post.content = { hook: gen.hook, body: gen.body, hashtags: gen.hashtags, fullText: gen.fullText };
      post.xMessageTemplate = gen.xMessage;
      await post.save().catch(() => {});
      await step('writing_content', 'done');
    }

    // 3. Generate the image.
    if (only !== 'text') {
      await step('creating_image', 'active', { label: 'Creating image' });
      const cfg = socialAi.requireConfig('image');
      const { buffer, ext } = await socialAi.generateImage(cfg, post.imagePrompt);
      await fs.promises.mkdir(SOCIAL_UPLOAD_DIR, { recursive: true });

      // Replace any previous image file.
      removeImageFile(post.imagePath);
      const name = `${crypto.randomUUID()}${ext}`;
      await fs.promises.writeFile(path.join(SOCIAL_UPLOAD_DIR, name), buffer);
      post.imagePath = `/uploads/social/${name}`;
      await post.save().catch(() => {});
      await step('creating_image', 'done');
    }

    // 4. Finalize.
    await step('saving_draft', 'active', { label: 'Saving draft' });
    post.status = 'ready';
    post.lastError = '';
    if (!post.title) post.title = (post.content.hook || '').slice(0, 120);
    await post.save();
    await step('saving_draft', 'done', {
      result: { status: 'ready', imagePath: post.imagePath },
    });
  } catch (err) {
    console.error(`[social-job:generate]`, err?.message || err);
    const msg = safeMessage(err);
    try {
      post.status = 'failed';
      post.lastError = msg;
      await post.save();
    } catch (saveErr) {
      console.error('[social-job:generate] could not persist failure:', saveErr?.message);
    }
    emitSocialProgress(postId, currentKey, {
      status: 'error',
      error: msg,
    });
    // Swallow — state is already recorded; Bull retry would double-spend AI calls.
  }
}

function removeImageFile(imagePath) {
  try {
    if (!imagePath || !imagePath.startsWith('/uploads/social/')) return;
    const resolved = path.resolve(path.join(__dirname, '..', imagePath));
    if (!resolved.startsWith(SOCIAL_UPLOAD_DIR + path.sep)) return;
    fs.promises.unlink(resolved).catch(() => {});
  } catch {
    // best-effort cleanup only
  }
}

/* ── Publish pipeline ─────────────────────────────────────────────────────── */

/** Load a platform connection with its (encrypted) tokens decrypted. */
async function loadConnection(platform) {
  const SocialConnection = require('../models/SocialConnection');
  const { decryptToken } = require('../utils/cryptoSocial');
  const row = await SocialConnection.findOne({ platform })
    .select('+accessToken +refreshToken platformUserId platformUserName status expiresAt')
    .lean();
  if (!row || row.status !== 'connected') return null;
  const accessToken = decryptToken(row.accessToken);
  if (!accessToken) return null;
  return {
    platformUserId: row.platformUserId,
    accessToken,
    expiresAt: row.expiresAt,
  };
}

async function processPublishLinkedInJob(job) {
  const SocialPost = require('../models/SocialPost');
  const { emitSocialProgress } = module.exports;
  const linkedinService = require('../services/linkedinService');
  const connection = await loadConnection('linkedin');

  const postId = String(job.data?.postId || '');
  const post = await SocialPost.findById(postId);
  if (!post) return;

  const steps = PUBLISH_STEPS.linkedin;
  let currentKey = steps[0].key;
  const step = async (key, status, extra = {}) => {
    if (status === 'active') currentKey = key;
    return emitSocialProgress(postId, key, { status, platform: 'linkedin', ...extra });
  };
  const fail = async (msg) => {
    try {
      post.publishes.push({ platform: 'linkedin', ok: false, error: msg, postedAt: new Date() });
      await post.save();
    } catch { /* best-effort */ }
    emitSocialProgress(postId, currentKey, { status: 'error', platform: 'linkedin', error: msg });
  };

  try {
    if (!connection) {
      return fail('LinkedIn is not connected. Please connect it first.');
    }
    if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
      const SocialConnection = require('../models/SocialConnection');
      await SocialConnection.updateOne({ platform: 'linkedin' }, { $set: { status: 'expired' } }).catch(() => {});
      return fail('LinkedIn connection expired. Please reconnect.');
    }

    await step('preparing_upload', 'active', { label: steps[0].label });

    let imageAssetUrn = null;
    if (post.imagePath) {
      const filePath = path.resolve(path.join(__dirname, '..', post.imagePath));
      if (filePath.startsWith(SOCIAL_UPLOAD_DIR + path.sep) && fs.existsSync(filePath)) {
        const buffer = await fs.promises.readFile(filePath);
        const ext = (path.extname(filePath).toLowerCase().replace('.', '') || 'png');
        const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
        await step('uploading_image', 'active', { label: steps[1].label });
        const { asset, uploadUrl } = await linkedinService.registerImageUpload(
          connection.accessToken,
          connection.platformUserId
        );
        await linkedinService.uploadImageBinary(connection.accessToken, uploadUrl, buffer, contentType);
        imageAssetUrn = asset;
      }
    }

    await step('creating_post', 'active', { label: steps[2].label });
    const text = post.content?.fullText ||
      [post.content?.hook, post.content?.body].filter(Boolean).join('\n\n');
    const result = await linkedinService.createPost(
      connection.accessToken,
      connection.platformUserId,
      { text, imageAssetUrn }
    );

    await step('verifying', 'active', { label: steps[3].label });
    post.publishes.push({
      platform: 'linkedin',
      url: result.url,
      platformPostId: result.platformPostId,
      ok: true,
      postedAt: new Date(),
    });
    post.linkedinCount = (post.linkedinCount || 0) + 1; // success-only counter
    await post.save();

    await step('verifying', 'done', { result: { url: result.url, platformPostId: result.platformPostId } });
  } catch (err) {
    console.error('[social-job:publish-linkedin]', err?.message || err);
    await fail(safePublishMessage(err));
  }
}

async function processPublishXJob(job) {
  const SocialPost = require('../models/SocialPost');
  const { emitSocialProgress } = module.exports;
  const xService = require('../services/xService');
  const connection = await loadConnection('x');

  const postId = String(job.data?.postId || '');
  const post = await SocialPost.findById(postId);
  if (!post) return;

  const steps = PUBLISH_STEPS.x;
  let currentKey = steps[0].key;
  const step = async (key, status, extra = {}) => {
    if (status === 'active') currentKey = key;
    return emitSocialProgress(postId, key, { status, platform: 'x', ...extra });
  };
  const fail = async (msg) => {
    try {
      post.publishes.push({ platform: 'x', ok: false, error: msg, postedAt: new Date() });
      await post.save();
    } catch { /* best-effort */ }
    emitSocialProgress(postId, currentKey, { status: 'error', platform: 'x', error: msg });
  };

  try {
    if (!connection) {
      return fail('X is not connected. Please connect it first.');
    }
    if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
      const SocialConnection = require('../models/SocialConnection');
      await SocialConnection.updateOne({ platform: 'x' }, { $set: { status: 'expired' } }).catch(() => {});
      return fail('X connection expired. Please reconnect.');
    }

    const linkedinUrl = (post.publishes || [])
      .filter((p) => p.platform === 'linkedin' && p.ok && p.url)
      .map((p) => p.url)
      .pop();
    const teaser = (post.xMessageTemplate || '').trim();
    const text = [teaser, linkedinUrl].filter(Boolean).join('\n');
    if (!text) {
      return fail('Nothing to post to X — add a teaser message or publish to LinkedIn first.');
    }

    await step('composing_tweet', 'active', { label: steps[0].label });
    const result = await xService.createPost(connection.accessToken, { text });

    await step('posting_tweet', 'active', { label: steps[1].label });
    await step('verifying', 'active', { label: steps[2].label });

    post.publishes.push({
      platform: 'x',
      url: result.url,
      platformPostId: result.id,
      ok: true,
      postedAt: new Date(),
    });
    post.xCount = (post.xCount || 0) + 1; // success-only counter
    await post.save();

    await step('verifying', 'done', { result: { url: result.url } });
  } catch (err) {
    console.error('[social-job:publish-x]', err?.message || err);
    await fail(safePublishMessage(err));
  }
}

/** Attach processors to the shared queue exactly once. */
async function registerSocialJobs() {
  if (_registered) return;
  _registered = true;
  try {
    const queue = await getQueue();
    await queue.process(JOB.GENERATE, processGenerateJob);
    await queue.process(JOB.PUBLISH_LINKEDIN, processPublishLinkedInJob);
    await queue.process(JOB.PUBLISH_X, processPublishXJob);
  } catch (err) {
    _registered = false;
    throw err;
  }
}

/** Producer: full or partial regeneration. attempts=1 (AI spend protection). */
async function enqueueGenerate(postId, only = null) {
  await registerSocialJobs();
  return enqueueSocialJob(
    JOB.GENERATE,
    { postId: String(postId), ...(only ? { only } : {}) },
    { attempts: 1, jobId: `${JOB.GENERATE}:${postId}:${Date.now()}` }
  );
}

/** Producer: queue a LinkedIn publish. attempts=1 — a retry would double-post. */
async function enqueuePublishLinkedIn(postId) {
  await registerSocialJobs();
  return enqueueSocialJob(
    JOB.PUBLISH_LINKEDIN,
    { postId: String(postId) },
    { attempts: 1, jobId: `${JOB.PUBLISH_LINKEDIN}:${postId}:${Date.now()}` }
  );
}

/** Producer: queue an X teaser post. attempts=1 — a retry would double-post. */
async function enqueuePublishX(postId) {
  await registerSocialJobs();
  return enqueueSocialJob(
    JOB.PUBLISH_X,
    { postId: String(postId) },
    { attempts: 1, jobId: `${JOB.PUBLISH_X}:${postId}:${Date.now()}` }
  );
}

module.exports = {
  JOB,
  GENERATION_STEPS,
  PUBLISH_STEPS,
  setSocialIO,
  emitSocialProgress,
  enqueueSocialJob,
  enqueueGenerate,
  enqueuePublishLinkedIn,
  enqueuePublishX,
  registerSocialJobs,
};
