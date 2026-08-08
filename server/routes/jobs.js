const Job = require('../models/Job');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { strArray, str, int } = require('../middleware/validate');
const { decrypt } = require('../utils/credentials');
const { getAdapter } = require('../adapters');
const { buildDedupeKey, parsePostedDate } = require('../services/jobDedupe');

const MAX_FETCH_JOBS = 100;

async function getSearchKeywords() {
  const [profile, skills] = await Promise.all([
    Profile.findOne().lean(),
    Skill.find().lean(),
  ]);
  const title = profile?.title || '';
  const stack = skills
    .flatMap((c) => (Array.isArray(c.items) ? c.items : []))
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean)
    .slice(0, 6);
  const parts = [];
  if (title) parts.push(title);
  parts.push(...stack);
  return parts.join(' ').trim();
}

function applyBlocklist(jobs, blocklist) {
  const names = (blocklist || []).map((b) => String(b.name || '').toLowerCase().trim()).filter(Boolean);
  if (!names.length) return jobs;
  return jobs.filter((j) => {
    const company = String(j.company || '').toLowerCase().trim();
    return !names.some((n) => company.includes(n) || n.includes(company));
  });
}

/**
 * Fetch jobs for one user + one site and upsert into the Job collection.
 * Shared by the HTTP handler and the scheduled refresh worker.
 */
async function fetchFromSite({ userId, site, location = '', pageCount = 1, maxJobs = 50 }) {
  const doc = await UserJobSite.findOne({ userId, name: site }).select('+credentials').lean();
  if (!doc || !doc.enabled) return { site, count: 0, created: 0, updated: 0, skipped: 0 };
  const creds = decrypt(doc.credentials);
  const settings = await UserSettings.findOne({ userId }).lean();
  const adapter = getAdapter(site);

  let raw;
  if (creds?.email && creds?.password) {
    await adapter.login({ email: creds.email, password: creds.password }).catch(() => {});
  }
  raw = await adapter.searchJobs({ query: await getSearchKeywords(), location, pageCount, maxJobs });

  const jobs = applyBlocklist(raw, settings?.blocklist || []);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();
  for (const j of jobs) {
    const dedupeKey = buildDedupeKey(j);
    const existing = await Job.findOne({ userId, dedupeKey }).exec();
    if (existing) {
      await Job.updateOne(
        { _id: existing._id },
        { $set: { lastSeenAt: now, url: j.url, location: j.location || existing.location } }
      );
      updated++;
      continue;
    }
    if (j.siteJobId && (await Job.exists({ userId, site, siteJobId: j.siteJobId }))) {
      skipped++;
      continue;
    }
    await Job.create({
      userId,
      title: j.title,
      company: j.company,
      location: j.location || '',
      salary: j.salary || '',
      description: '',
      url: j.url,
      site,
      siteJobId: j.siteJobId || '',
      dedupeKey,
      postedDate: parsePostedDate(j.postedText),
      lastSeenAt: now,
      status: 'new',
    });
    created++;
  }

  await UserJobSite.updateOne({ userId, name: site }, { $set: { lastFetched: now } });
  return { site, count: jobs.length, created, updated, skipped };
}

/**
 * POST /api/jobs/fetch?site=naukri&site=indeed
 * Runs Puppeteer searches for each enabled site, normalizes, dedupes, filters
 * blocklist, and upserts Job documents.
 */
exports.fetch = asyncHandler(async (req, res) => {
  const requested = strArray(req.query, 'site', { maxItems: 5, optional: true });
  const location = str(req.query, 'location', { max: 100, optional: true });
  const pageCount = int(req.query, 'pages', { min: 1, max: 5, optional: true }) || 1;
  const maxJobs = int(req.query, 'max', { min: 1, max: MAX_FETCH_JOBS, optional: true }) || 50;

  const sites = await UserJobSite.find({ userId: req.adminId, enabled: true }).lean();
  const enabledNames = requested.length ? requested.filter((r) => sites.some((s) => s.name === r)) : sites.map((s) => s.name);
  if (!enabledNames.length) {
    throw new AppError('No enabled job sites. Enable a site and save credentials first.', 400, 'NO_ENABLED_SITES');
  }

  const keywords = await getSearchKeywords();
  if (!keywords) {
    throw new AppError('Add a profile title or skills first so we know what to search for.', 400, 'NO_KEYWORDS');
  }

  const results = { sites: [], total: 0, created: 0, updated: 0, skipped: 0, errors: [] };

  for (const site of enabledNames) {
    try {
      const outcome = await fetchFromSite({ userId: req.adminId, site, location, pageCount, maxJobs });
      results.sites.push(outcome);
      results.total += outcome.count;
      results.created += outcome.created;
      results.updated += outcome.updated;
      results.skipped += outcome.skipped;
    } catch (err) {
      results.errors.push({ site, error: err.message || 'Fetch failed' });
    }
  }

  Activity.create({
    type: 'jobs_fetched',
    description: 'Fetched jobs from job sites',
    metadata: { userId: req.adminId, sites: enabledNames, total: results.total, errors: results.errors.length },
  }).catch(() => {});

  res.json(results);
});

/** GET /api/jobs — paginated, filterable job list (Phase 2 UI). */
exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.adminId };

  const site = req.query.site;
  if (site) filter.site = site;
  const status = req.query.status;
  if (status) filter.status = status;
  const age = req.query.age; // 24h | 3d | 7d | 14d
  if (age) {
    const hours = { '24h': 24, '3d': 72, '7d': 168, '14d': 336 }[age];
    if (hours) filter.postedDate = { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
  }
  const minScore = parseInt(req.query.minScore, 10);
  if (!Number.isNaN(minScore)) filter.matchScore = { $gte: minScore };
  const q = String(req.query.q || '').trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: re }, { company: re }];
  }

  const [total, items] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .sort({ postedDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

module.exports.getSearchKeywords = getSearchKeywords;
module.exports.fetchFromSite = fetchFromSite;
