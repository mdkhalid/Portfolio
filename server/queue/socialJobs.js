const { getQueue } = require('./index');

/**
 * Social Publisher queue jobs + live progress events.
 * Producers are used by /api/social routes; processors register in later
 * phases (generation in Phase 2, publishing in Phase 4) via registerSocialJobs.
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
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
    jobId: opts.jobId,
    ...opts,
  });
}

module.exports = {
  JOB,
  GENERATION_STEPS,
  PUBLISH_STEPS,
  setSocialIO,
  emitSocialProgress,
  enqueueSocialJob,
};
