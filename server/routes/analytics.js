const Analytics = require('../models/Analytics');

const today = () => new Date().toISOString().slice(0, 10);

exports.track = async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const date = today();
    let record = await Analytics.findOne({ date });
    if (!record) record = await Analytics.create({ date, pageViews: 0, uniqueIPs: [] });
    record.pageViews += 1;
    if (!record.uniqueIPs.includes(ip)) record.uniqueIPs.push(ip);
    await record.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.stats = async (req, res) => {
  try {
    const records = await Analytics.find().sort({ date: -1 }).limit(90);
    const total = records.reduce((s, r) => s + r.pageViews, 0);
    const unique = [...new Set(records.flatMap(r => r.uniqueIPs))].length;
    res.json({ records, total, unique });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
