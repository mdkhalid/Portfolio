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

/** Attach processors to the shared queue exactly once. */
async function registerSocialJobs() {
  if (_registered) return;
  _registered = true;
  try {
    const queue = await getQueue();
    await queue.process(JOB.GENERATE, processGenerateJob);
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

module.exports = {
  JOB,
  GENERATION_STEPS,
  PUBLISH_STEPS,
  setSocialIO,
  emitSocialProgress,
  enqueueSocialJob,
  enqueueGenerate,
  registerSocialJobs,
};
