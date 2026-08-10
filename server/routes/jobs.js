const Job = require('../models/Job');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Project = require('../models/Project');
const Resume = require('../models/Resume');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { strArray, str, int } = require('../middleware/validate');
const { decrypt } = require('../utils/credentials');
const { getAdapter } = require('../adapters');
const { buildDedupeKey, parsePostedDate } = require('../services/jobDedupe');
const { getAIClient } = require('../ai/client');
const { sanitizeForAI } = require('../utils/security');

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
    .slice(0, 4);
  const parts = title ? [title] : [];
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
    // Timeout login attempt to max 10 seconds so it never hangs the fetch request
    await Promise.race([
      adapter.login({ email: creds.email, password: creds.password }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Login timeout')), 10000))
    ]).catch(() => {});
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

/**
 * POST /api/jobs/match
 * Calculate AI match scores for jobs. Body: { jobIds: string[] } or no body to match all unmatched jobs.
 * Uses OpenAI/Groq to compare job description against profile + skills + experience.
 */
exports.match = asyncHandler(async (req, res) => {
  const jobIds = Array.isArray(req.body?.jobIds) ? req.body.jobIds : null;
  const limit = Math.min(50, Math.max(1, parseInt(req.body?.limit, 10) || 20));

  const filter = { userId: req.adminId };
  if (jobIds && jobIds.length) {
    filter._id = { $in: jobIds };
  } else {
    filter.matchScore = { $in: [null, undefined] };
  }

  const jobs = await Job.find(filter).limit(limit).lean();
  if (!jobs.length) {
    return res.json({ matched: 0, jobs: [] });
  }

  // Try parsing the candidate's actual uploaded PDF resume first
  let profileText = await getUploadedResumeText();

  // If no uploaded resume exists, fallback to database profile context
  if (!profileText || profileText.length < 100) {
    const [profile, skills, experiences, education, certifications, projects] = await Promise.all([
      Profile.findOne().lean(),
      Skill.find().lean(),
      Experience.find().lean(),
      Education.find().lean(),
      Certification.find().lean(),
      Project.find().lean(),
    ]);

    profileText = buildProfileText(profile, skills, experiences, education, certifications, projects);
  }

  const { client, model } = await getAIClient('chat');
  if (!client) {
    // Fallback: simple keyword overlap
    const results = await Promise.all(jobs.map(j => fallbackMatch(j, profileText)));
    for (const r of results) {
      await Job.updateOne({ _id: r.jobId }, { $set: { matchScore: r.score, matchedKeywords: r.matched, missingKeywords: r.missing } });
    }
    return res.json({ matched: results.length, jobs: results });
  }

  const results = [];
  for (const job of jobs) {
    try {
      const jd = job.description || '';
      if (!jd || jd.trim().length < 20) {
        // Try to fetch full JD if missing
        const settings = await UserSettings.findOne({ userId: req.adminId }).lean();
        const siteDoc = await UserJobSite.findOne({ userId: req.adminId, name: job.site }).select('+credentials').lean();
        if (siteDoc?.credentials && job.url) {
          const creds = decrypt(siteDoc.credentials);
          const adapter = getAdapter(job.site);
          if (creds?.email && creds?.password) {
            await adapter.login({ email: creds.email, password: creds.password }).catch(() => {});
          }
          try {
            const full = await adapter.fetchJobDescription({ url: job.url });
            if (full?.description) {
              job.description = full.description;
              await Job.updateOne({ _id: job._id }, { $set: { description: full.description } });
            }
          } catch {}
        }
      }

      const prompt = `You are an expert, realistic ATS matching engine. Compare the candidate profile against the job description.

A candidate with strong relevant experience and core technologies matched should receive a high score (75-95%). Do NOT punish candidates overly for minor missing secondary buzzwords if their primary domain, role title, and tech stack closely align.

Evaluate fairly:
1. Core Role & Title Alignment (30% weight): Does candidate's title/experience match the position?
2. Technical Stack Match (50% weight): Are key mandatory tools/languages present in the candidate profile?
3. Domain & Experience Level (20% weight): Does candidate have required years of experience?

Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "matchedKeywords": ["keyword1", "keyword2", ...],
  "missingKeywords": ["keyword1", "keyword2", ...],
  "reasoning": "<1-2 sentence constructive breakdown of score>"
}

CANDIDATE PROFILE:
${profileText.slice(0, 6000)}

JOB DESCRIPTION:
${(job.description || jd).slice(0, 4000)}`;

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an expert ATS matching engine. Return only valid JSON with score, matchedKeywords, missingKeywords, and reasoning.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response');

      const parsed = JSON.parse(text);
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const matched = Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords.slice(0, 20) : [];
      const missing = Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords.slice(0, 20) : [];

      await Job.updateOne(
        { _id: job._id },
        { $set: { matchScore: score, matchedKeywords: matched, missingKeywords: missing } }
      );

      results.push({ jobId: job._id, score, matched, missing, reasoning: parsed.reasoning });
    } catch (err) {
      console.error(`Match failed for job ${job._id}:`, err.message || err);
      // Fallback for this job
      const fallback = await fallbackMatch(job, profileText);
      await Job.updateOne(
        { _id: job._id },
        { $set: { matchScore: fallback.score, matchedKeywords: fallback.matched, missingKeywords: fallback.missing } }
      );
      results.push(fallback);
    }
  }

  res.json({ matched: results.length, jobs: results });
});

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function getUploadedResumeText() {
  try {
    const resumes = await Resume.find().sort({ order: 1 }).lean();
    if (!resumes || !resumes.length) return '';

    // Pick domestic/default resume (e.g. first resume or labeled 'domestic'/'default')
    const chosen = resumes.find(r => /domestic|main|primary/i.test(r.label)) || resumes[0];
    if (!chosen || !chosen.fileUrl) return '';

    // fileUrl is typically /uploads/filename.pdf
    const fileName = path.basename(chosen.fileUrl);
    const fullPath = path.join(__dirname, '..', 'uploads', fileName);

    if (!fs.existsSync(fullPath)) return '';

    const dataBuffer = fs.readFileSync(fullPath);
    const parser = new PDFParse({ data: dataBuffer });
    const parsed = await parser.getText();
    parser.destroy();

    return parsed?.text ? sanitizeForAI(parsed.text) : '';
  } catch (err) {
    console.error('Failed to parse uploaded resume PDF for matching:', err.message);
    return '';
  }
}

function buildProfileText(profile, skills, experiences, education, certifications, projects) {
  const parts = [];
  if (profile) {
    parts.push(`Name: ${profile.name}`);
    parts.push(`Title: ${profile.title}`);
    parts.push(`Experience: ${profile.experienceYears || 0} years`);
    if (profile.summary) parts.push(`Summary: ${profile.summary}`);
    parts.push(`Location: ${profile.location}`);
  }
  if (skills?.length) {
    const allSkills = skills.flatMap(c => (Array.isArray(c.items) ? c.items : [])).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
    parts.push(`Skills: ${allSkills.join(', ')}`);
  }
  if (experiences?.length) {
    parts.push('Experience:');
    experiences.forEach(e => {
      parts.push(`- ${e.role} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'})`);
      if (e.bullets?.length) parts.push(e.bullets.join(' '));
    });
  }
  if (projects?.length) {
    parts.push('Projects:');
    projects.forEach(p => {
      parts.push(`- ${p.name}: ${p.description}`);
      if (p.techStack?.length) parts.push(`Tech: ${p.techStack.join(', ')}`);
    });
  }
  if (education?.length) {
    parts.push('Education:');
    education.forEach(e => parts.push(`- ${e.degree} in ${e.field} from ${e.institution} (${e.startDate} - ${e.endDate || 'Present'})`));
  }
  if (certifications?.length) {
    parts.push('Certifications:');
    certifications.forEach(c => parts.push(`- ${c.name} (${c.issuer})`));
  }
  return parts.join('\n');
}

async function fallbackMatch(job, profileText) {
  const jdText = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
  const profileLower = profileText.toLowerCase();

  // Extract meaningful tech & domain keywords from JD
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'your', 'their', 'what', 'which', 'about', 'into', 'than', 'then', 'also', 'more', 'some', 'such', 'only', 'other', 'over', 'very', 'just', 'could', 'should', 'would', 'and', 'the', 'for', 'are', 'you', 'not', 'but', 'his', 'her', 'was', 'has', 'had', 'can', 'our', 'who', 'its', 'may', 'one', 'all', 'out', 'she', 'him', 'his', 'how', 'now', 'see', 'two', 'way', 'did', 'get', 'use', 'man', 'new', 'any', 'old', 'too', 'day', 'did', 'experience', 'years', 'role', 'team', 'work', 'working', 'ability', 'strong', 'knowledge', 'skills', 'good', 'well', 'must', 'required']);
  const jdWords = jdText.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
  const uniqueJdWords = [...new Set(jdWords)];

  const matched = uniqueJdWords.filter(w => profileLower.includes(w));
  const missing = uniqueJdWords.filter(w => !profileLower.includes(w));
  
  // Calculate percentage, floor at 75% for experienced matches
  const ratio = uniqueJdWords.length > 0 ? (matched.length / uniqueJdWords.length) : 0.8;
  const score = Math.max(75, Math.min(95, Math.round(ratio * 100 + 35)));

  return {
    jobId: job._id,
    score,
    matched: matched.slice(0, 15),
    missing: missing.slice(0, 15),
    reasoning: 'Fallback keyword overlap (75-95% weighted score)'
  };
}

/** PUT /api/jobs/:id — update job status (apply/pass). */
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await Job.findOne({ _id: id, userId: req.adminId });
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

  const updates = {};
  if (req.body.status) {
    const validStatuses = ['new', 'pending', 'applied', 'passed', 'not_applied', 'expired'];
    if (!validStatuses.includes(req.body.status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }
    updates.status = req.body.status;
    if (req.body.status === 'applied') {
      updates.applied = true;
      updates.appliedAt = new Date();
      updates.appliedVia = 'manual';
    }
  }

  const updated = await Job.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  res.json(updated);
});
