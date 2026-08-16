const rateLimit = require('express-rate-limit');

const getClientIp = (req) => {
  const trustProxy = req.app.get('trust proxy');
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map((ip) => ip.trim());
      const hopCount = typeof trustProxy === 'number' ? trustProxy : 1;
      return ips[Math.max(0, ips.length - hopCount)];
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createLimiter = (options) =>
  rateLimit({
    ...options,
    keyGenerator: getClientIp,
    validate: false,
  });

// Auth: 5 attempts per 15 minutes per IP
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact: 3 messages per hour per IP
const contactLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many messages sent. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Resume download: 10 downloads per 15 minutes per IP
const resumeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many download requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat: 20 messages per 15 minutes per IP
const chatLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many chat messages. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ATS Scoring: 5 requests per 15 minutes per IP
const atsLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many ATS score requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global: configurable per env
const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Job fetch: 10 fetches per 15 minutes per IP (Puppeteer is heavy + rate-limit-safe)
const jobFetchLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many job fetch requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Job site credential save/test/login: 60 per 15 minutes per IP. GETs (site
// list refresh) are skipped — they're cheap and the UI refetches them often,
// which previously starved the bucket during one-time site setup flows.
const jobSiteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: (req) => req.method === 'GET',
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, contactLimiter, resumeLimiter, chatLimiter, atsLimiter, globalLimiter, jobFetchLimiter, jobSiteLimiter };
