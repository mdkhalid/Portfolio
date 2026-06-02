const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const compression = require('compression');
const { noSqlSanitize } = require('./noSqlSanitize');

const isProd = process.env.NODE_ENV === 'production';

const parseList = (val) =>
  (val || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const allowedOrigins = (() => {
  const fromEnv = parseList(process.env.CLIENT_URL);
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const merged = [...new Set([...defaults, ...fromEnv])];
  return isProd ? fromEnv : merged;
})();

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

const helmetMiddleware = helmet({
  contentSecurityPolicy: isProd
    ? {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  hidePoweredBy: true,
});

const sanitizeMiddleware = noSqlSanitize;

const hppMiddleware = hpp({
  whitelist: ['tags', 'techStack', 'category'],
});

const compressionMiddleware = compression({
  threshold: 1024,
  level: 6,
});

module.exports = {
  isProd,
  allowedOrigins,
  corsMiddleware,
  helmetMiddleware,
  sanitizeMiddleware,
  hppMiddleware,
  compressionMiddleware,
};
