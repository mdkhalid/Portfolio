const crypto = require('crypto');

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Build a stable dedupe key from a job's identity fields so the same role
 * posted on multiple sites (Naukri + Indeed) maps to one document.
 */
function buildDedupeKey({ title, company, location }) {
  const parts = [normalize(title), normalize(company), normalize(location)];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

/**
 * Parse a relative/absolute posted-date string into a Date (best effort).
 * Returns null when it can't be parsed (buckets to "Any").
 */
function parsePostedDate(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const m = t.match(/(\d+)\s*(?:day|d)\s*(?:ago)?/);
  if (m) return new Date(now - Number(m[1]) * day);
  const w = t.match(/(\d+)\s*(?:week|w)\s*(?:ago)?/);
  if (w) return new Date(now - Number(w[1]) * 7 * day);
  const h = t.match(/(\d+)\s*(?:hour|hr|h)\s*(?:ago)?/);
  if (h) return new Date(now - Number(h[1]) * 60 * 60 * 1000);
  const d = Date.parse(text);
  return Number.isNaN(d) ? null : new Date(d);
}

module.exports = { buildDedupeKey, parsePostedDate, normalize };
