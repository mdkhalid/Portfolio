const Job = require('../models/Job');
const mongoose = require('mongoose');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Project = require('../models/Project');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { strArray, str, int } = require('../middleware/validate');
const { decrypt } = require('../utils/credentials');
const { getAdapter, SITE_META, isAutomatedSite } = require('../adapters');
const { buildDedupeKey, parsePostedDate } = require('../services/jobDedupe');
const { getUploadedResumeText } = require('../services/resumeGenerate');
const { toCanonicalKey } = require('../services/applyFields');
const { getAIClient } = require('../ai/client');
const { sanitizeJdForAI } = require('../utils/security');
const { emitJobsChanged } = require('../services/notifications');
const Application = require('../models/Application');
const ApplyField = require('../models/ApplyField');
const crypto = require('crypto');
const { getQueue } = require('../queue');
const { checkAICost, recordAICost } = require('../services/aiCost');

const MAX_FETCH_JOBS = 100;

/**
 * Build the search query for a site from the profile title + top skills.
 * Sites AND together every word they receive, so mashing title + skills into
 * one query yields noisy/empty results: Indeed and Naukri get the title only
 * (Naukri's URL slug ANDs every word — title + 2 skills cut result counts
 * dramatically), the rest get title + top 3.
 */
async function getSearchKeywords(site = '') {
  const [profile, skills] = await Promise.all([
    Profile.findOne().lean(),
    Skill.find().lean(),
  ]);
  const title = profile?.title || '';
  const stack = skills
    .flatMap((c) => (Array.isArray(c.items) ? c.items : []))
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean);
  const key = String(site || '').toLowerCase();
  const skillCount = key === 'indeed' || key === 'naukri' ? 0 : 3;
  const parts = title ? [title] : [];
  parts.push(...stack.slice(0, skillCount));
  return parts.join(' ').trim();
}

function applyBlocklist(jobs, blocklist) {
  // Entries shorter than 2 chars over-match everything; drop them.
  const names = (blocklist || [])
    .map((b) => String(b.name || '').toLowerCase().trim())
    .filter((n) => n.length >= 2);
  if (!names.length) return jobs;
  return jobs.filter((j) => {
    const company = String(j.company || '').toLowerCase().trim();
    if (!company) return true;
    return !names.some((n) => {
      if (company === n) return true;
      // Word-boundary match inside the company name only: loose two-way
      // substring matching let a short entry like "ib" block "IBM".
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(company);
    });
  });
}

/**
 * Fetch jobs for one user + one site and upsert into the Job collection.
 * Shared by the HTTP handler and the scheduled refresh worker.
 */
async function fetchFromSite({ userId, site, location = '', pageCount = 1, maxJobs = 50 }) {
  const doc = await UserJobSite.findOne({ userId, name: site }).select('+credentials +cookies').lean();
  if (!doc || !doc.enabled) return { site, count: 0, created: 0, updated: 0, skipped: 0 };
  if (!isAutomatedSite(site)) {
    // Custom sites have no search automation; jobs are added manually.
    return { site, count: 0, created: 0, updated: 0, skipped: 0, manualOnly: true };
  }
  const creds = doc.credentials ? decrypt(doc.credentials) : null;
  const cookieHeader = doc.cookies ? decrypt(doc.cookies)?.value : null;
  const settings = await UserSettings.findOne({ userId }).lean();
  const adapter = getAdapter(site);

  const doSearch = async () => adapter.searchJobs({ query: await getSearchKeywords(site), location, pageCount, maxJobs });

  let raw = await doSearch();

  // Search-first: public listings work without a session. Only attempt login
  // (credentials/cookies) as a fallback if the initial search returned nothing
  // — logging in first poisons the shared browser session (Indeed CAPTCHA)
  // and makes the subsequent search return 0 results.
  if (!raw.length && (creds?.email || cookieHeader)) {
    try {
      await adapter.login(
        cookieHeader
          ? { cookies: cookieHeader, cookieOrigin: SITE_META[site]?.homeUrl || null }
          : { email: creds.email, password: creds.password }
      );
    } catch (e) {
      // Login is best-effort for search; searchJobs still runs unauth'd.
      console.error(`[fetch] ${site} login fallback failed:`, e?.message || e);
    }
    raw = await doSearch();
  }

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
  // Push a change signal so any open dashboard refreshes without a manual reload
  // (covers the HTTP fetch route AND the background scheduler fetch).
  emitJobsChanged(userId);
  return { site, count: jobs.length, created, updated, skipped };
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
  
  const ratio = uniqueJdWords.length > 0 ? (matched.length / uniqueJdWords.length) : 0;
  const score = Math.round(ratio * 100);

  return {
    jobId: job._id,
    score,
    matched: matched.slice(0, 15),
    missing: missing.slice(0, 15),
    reasoning: 'Fallback keyword overlap (75-95% weighted score)'
  };
}

// ─── Phase 5: Application Tracking & Status Management ─────────────────────────

const TRACKING_STATUSES = [
  'queued', 'running', 'applied', 'pending', 'failed', 'passed', 'canceled', 'not_applied',
];
const NOT_APPLIED_REASONS = [
  'job_expired', 'login_failed', 'site_error', 'missing_info',
  'location_mismatch', 'salary_mismatch', 'blocked_or_captcha', 'manual_skip', 'other',
];

module.exports = {
  Job, mongoose, UserJobSite, UserSettings, Profile, Skill, Experience,
  Education, Certification, Project, Activity, Application, ApplyField,
  crypto, asyncHandler, AppError, strArray, str, int, decrypt,
  getAdapter, SITE_META, isAutomatedSite, buildDedupeKey, parsePostedDate,
  getUploadedResumeText, toCanonicalKey, getAIClient, sanitizeJdForAI,
  emitJobsChanged, getQueue, checkAICost, recordAICost,
  MAX_FETCH_JOBS, TRACKING_STATUSES, NOT_APPLIED_REASONS,
  getSearchKeywords, applyBlocklist, fetchFromSite, buildProfileText, fallbackMatch,
};
