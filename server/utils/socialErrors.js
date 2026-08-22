/**
 * Centralized error handling for the Social Publisher subsystem.
 * Every LinkedIn/X/AI failure funnels through here so that:
 *  - raw provider responses, tokens or keys never reach the client,
 *  - every failure has a stable SOCIAL_* code the UI can branch on,
 *  - details are logged once, server-side.
 */

const { AppError } = require('../middleware/errorHandler');

/** Human-safe message per operation — the ONLY text clients ever see. */
const SAFE_MESSAGES = {
  oauth_start: 'Could not start sign-in. Please try again.',
  oauth_callback: 'Sign-in failed or was cancelled. Please reconnect.',
  oauth_state: 'Sign-in session expired. Please click Connect again.',
  token_exchange: 'Could not complete sign-in with the platform. Please reconnect.',
  token_refresh: 'Connection expired. Please reconnect the platform.',
  profile_fetch: 'Connected, but could not load your profile name. Posting still works.',
  disconnected: 'Platform is not connected. Please connect it first.',
  content_generation: 'Content generation failed. Please try again or adjust your notes.',
  image_generation: 'Image generation failed. You can retry just the image.',
  prompt_build: 'Could not prepare prompts from your notes. Please rephrase and retry.',
  image_save: 'Generated image could not be saved. Please retry generation.',
  publish_precondition: 'This post is not ready to publish yet.',
  publish_linkedin: 'LinkedIn publishing failed. Nothing was posted — you can safely retry.',
  publish_x: 'Posting to X failed. Your LinkedIn post is untouched — you can safely retry.',
  rate_limited: 'The platform temporarily refused the request (rate limit). Wait a bit and retry.',
};

/** Safely extract status/detail from axios-style, fetch-style or plain errors. */
function providerErrorInfo(err) {
  const status =
    err?.response?.status ??
    (Number.isInteger(err?.statusCode) ? err.statusCode : null);

  let detail = '';
  const data = err?.response?.data;
  try {
    if (typeof data === 'string') detail = data;
    else if (data?.error?.message) detail = String(data.error.message);
    else if (data?.message) detail = String(data.message);
    else if (data?.error_description) detail = String(data.error_description);
    else if (data?.error) detail = typeof data.error === 'string' ? data.error : '';
    else if (data) detail = JSON.stringify(data);
  } catch {
    detail = '';
  }

  return {
    status,
    detail: (detail || err?.message || 'Unknown provider error').slice(0, 500),
  };
}

/**
 * Convert any thrown value into an AppError safe for the client.
 * Usage inside route handlers / services:
 *   catch (err) { socialFail('publish_linkedin', err); }
 */
function socialFail(operation, err, { status = 502 } = {}) {
  const { status: provStatus, detail } = providerErrorInfo(err);
  const isRateLimit = provStatus === 429 || /rate limit/i.test(detail);
  const code = `SOCIAL_${String(operation).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FAILED`;

  // One structured server-side log line; never surfaced to clients.
  console.error(
    `[social:${operation}]`,
    JSON.stringify({ providerStatus: provStatus, detail })
  );

  if (isRateLimit) {
    throw new AppError(SAFE_MESSAGES.rate_limited, 429, 'SOCIAL_RATE_LIMITED');
  }
  throw new AppError(SAFE_MESSAGES[operation] || 'Something went wrong. Please try again.', status, code);
}

/**
 * Wrap a Bull job processor so NO failure can crash the worker loop.
 * On error: emits a socket progress error (if emitter provided), lets the
 * caller persist state via onFail, then swallows (Bull records attempt).
 */
function safeJobProcessor(name, fn, { onError } = {}) {
  return async function processed(job) {
    try {
      return await fn(job);
    } catch (err) {
      console.error(`[social-job:${name}]`, err?.message || err);
      if (onError) {
        try {
          await onError(job, err);
        } catch (nested) {
          console.error(`[social-job:${name}] onError handler failed:`, nested?.message || nested);
        }
      }
      // Swallow: Bull/memory-queue handles retries & failure accounting.
    }
  };
}

module.exports = { SAFE_MESSAGES, providerErrorInfo, socialFail, safeJobProcessor };
