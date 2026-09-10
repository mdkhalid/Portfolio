const { isProd } = require('./security');

class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

// PII scrubbing for error logs. Production log lines keep the error name and
// a redacted message but never raw emails, tokens, cookies, or query strings.
// Recursion is depth-bounded to stay safe on weird error shapes.
const REDACT_REPLACEMENT = '[redacted]';
const PII_KEYS = /pass(word)?|secret|token|cookie|authorization|email|phone|ssn|creditcard|credit_card/i;
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_IN_TEXT = /\b(?:bearer|basic)\s+[A-Za-z0-9._-]{8,}/gi;
const MAX_LOG_DEPTH = 3;
const MAX_LOG_ARRAY = 5;
const MAX_MESSAGE_LEN = 500;

function redactText(value) {
  return String(value)
    .replace(BEARER_IN_TEXT, REDACT_REPLACEMENT)
    .replace(EMAIL_IN_TEXT, (m) => {
      const at = m.indexOf('@');
      if (at <= 1) return REDACT_REPLACEMENT;
      return m[0] + '***' + m.slice(at);
    })
    .slice(0, MAX_MESSAGE_LEN);
}

function scrubForLog(value, depth = 0) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return redactText(value);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'function') return '[fn]';
  if (depth >= MAX_LOG_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, MAX_LOG_ARRAY).map((v) => scrubForLog(v, depth + 1));
  if (t === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.test(k)) out[k] = REDACT_REPLACEMENT;
      else out[k] = scrubForLog(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Production-safe error serializer for console.error log lines. */
function logError(tag, err) {
  if (!isProd) {
    console.error(`[${tag}]`, err);
    return;
  }
  const base = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { message: String(err?.message || err) };
  console.error(`[${tag}]`, scrubForLog(base));
}

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: isProd ? undefined : err.message,
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier format' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', field: Object.keys(err.keyPattern || {})[0] });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: isProd ? 'Upload failed' : err.message });
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // Infrastructure failures: keep the app responsive with a clear 503 instead
  // of an opaque 500 (database down, upstream refused, DNS, timeouts).
  const msg = String(err?.message || '');
  if (
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongooseError' && /timed out|buffering/i.test(msg) ||
    /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/.test(String(err.code || '') + ' ' + msg)
  ) {
    logError('infra', err);
    return res.status(503).json({
      error: 'Service temporarily unavailable. Please try again shortly.',
      code: 'SERVICE_UNAVAILABLE',
    });
  }

  logError('unhandled', err);
  return res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Not found' });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, errorHandler, notFoundHandler, asyncHandler, __testables: { scrubForLog, redactText } };
