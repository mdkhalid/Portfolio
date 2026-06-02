const rateLimit = require('express-rate-limit');
const Analytics = require('../models/Analytics');
const { asyncHandler } = require('../middleware/errorHandler');
const { sha256 } = require('../utils/security');

const MAX_UNIQUE_IPS = 5000;

const today = () => new Date().toISOString().slice(0, 10);

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many tracking requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const getClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) {
    const ip = fwd.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

exports.track = [
  trackLimiter,
  asyncHandler(async (req, res) => {
    const rawIp = getClientIp(req);
    const ipHash = sha256(rawIp + (process.env.ANALYTICS_SALT || 'portfolio-default-salt'));
    const date = today();

    let record = await Analytics.findOne({ date });
    if (!record) {
      record = await Analytics.create({ date, pageViews: 0, uniqueIPs: [] });
    }
    record.pageViews += 1;
    if (record.uniqueIPs.length < MAX_UNIQUE_IPS && !record.uniqueIPs.includes(ipHash)) {
      record.uniqueIPs.push(ipHash);
    }
    await record.save();
    res.json({ ok: true });
  }),
];

exports.stats = asyncHandler(async (req, res) => {
  const records = await Analytics.find().sort({ date: -1 }).limit(90);
  const total = records.reduce((s, r) => s + r.pageViews, 0);
  const unique = [...new Set(records.flatMap((r) => r.uniqueIPs))].length;
  res.json({ records, total, unique });
});
