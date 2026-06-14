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

module.exports = { authLimiter, contactLimiter, resumeLimiter, chatLimiter, atsLimiter, globalLimiter };
