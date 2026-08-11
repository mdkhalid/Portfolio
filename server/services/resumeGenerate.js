const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const { getAIClient } = require('../ai/client');
const { checkAICost, recordAICost } = require('./aiCost');
const { buildResumePdf } = require('./resumePdf');

/**
 * Shared, ATS-friendly tailored resume builder.
 *
 * Loads the candidate profile and merges suggested keywords (extracted from the
 * job description via AI, with a deterministic fallback) into the Skills list,
 * and weaves 1-3 of the most important keywords into the Summary naturally.
 *
 * The resume STRUCTURE is never changed — same sections, order, and layout as
 * the base resume produced by buildResumePdf.
 */

async function loadProfileContext() {
  const [profile, skills, experiences, educationList, certList] = await Promise.all([
    Profile.findOne().lean().catch(() => null),
    Skill.find().lean().catch(() => []),
    Experience.find().lean().catch(() => []),
    Education.find().lean().catch(() => []),
    Certification.find().lean().catch(() => []),
  ]);
  const allSkills = skills
    .flatMap((c) => (Array.isArray(c.items) ? c.items : []))
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean);
  return { profile, skills: allSkills, experiences, educationList, certList };
}

function safeSlug(s) {
  return String(s || '').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'Resume';
}

function dedupeMerge(baseSkills, additions) {
  const lower = new Set(baseSkills.map((s) => s.toLowerCase()));
  const merged = baseSkills.slice();
  for (const kw of additions) {
    const t = String(kw || '').trim();
    if (t && !lower.has(t.toLowerCase())) {
      merged.push(t);
      lower.add(t.toLowerCase());
    }
  }
  return merged;
}

/**
 * @param {Object} job - Job document (uses description/title/company/matchedKeywords/missingKeywords)
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {boolean} [opts.skipOnBudgetExceeded=false] - when true, returns { aiSkipped } if budget hit
 * @returns {Promise<Object>} { aiSkipped?, reason?, pdf, pdfFilename, content, keywordsMatched, jdUsed, usedAI }
 */
async function buildTailoredResume(job, { userId, skipOnBudgetExceeded = false } = {}) {
  const ctx = await loadProfileContext();
  const baseSummary = ctx.profile?.summary || '';
  const baseSkills = ctx.skills.slice();
  const jd = String(job?.description || job?.title || '').slice(0, 4000);

  const { client, model } = await getAIClient('ats');
  const costCheck = await checkAICost(userId, { purpose: 'generate_resume' });
  const budgetOk = costCheck.allowed;

  if (skipOnBudgetExceeded && !budgetOk) {
    return { aiSkipped: true, reason: costCheck.reason };
  }

  let keywordsToAdd = [];
  let tailoredSummary = baseSummary;
  let usedAI = false;

  const useAI = !!client && budgetOk && jd.length >= 30;
  if (useAI) {
    try {
      const prompt = `You are an expert ATS resume optimizer. Compare the candidate's current resume context against the job description.

Return ONLY valid JSON:
{
  "keywords": ["TypeScript", "AWS Lambda"],
  "summary": "..."
}

Rules:
- "keywords": up to 8 missing tech skills/tools/frameworks/domain terms from the JD that the candidate should add. Omit terms they already have.
- "summary": take the candidate's current summary and weave in 1-3 of the most important missing keywords NATURALLY. Keep the same tone, voice, and approximate length. Do NOT invent new experience, employers, or claims. If the current summary is empty, return an empty string. Do not use awkward comma lists.

CANDIDATE CURRENT SUMMARY:
${baseSummary || '(empty)'}

CANDIDATE CURRENT SKILLS:
${baseSkills.join(', ')}

JOB DESCRIPTION:
${jd}`;

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an expert ATS resume optimizer. Return only valid JSON with keys "keywords" (array) and "summary" (string).' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices?.[0]?.message?.content;
      const parsed = JSON.parse(text || '{}');
      if (Array.isArray(parsed.keywords)) {
        keywordsToAdd = parsed.keywords
          .map((k) => String(k || '').trim())
          .filter(Boolean)
          .slice(0, 8);
      }
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
        tailoredSummary = parsed.summary.trim();
      }
      usedAI = keywordsToAdd.length > 0 || tailoredSummary !== baseSummary;
      recordAICost({ userId, purpose: 'generate_resume', jobId: job?._id || null }).catch(() => {});
    } catch (err) {
      // Fall through to deterministic fallback below
      console.error('[resumeGenerate] AI keyword merge failed:', err?.message || err);
    }
  }

  // Deterministic fallback when AI is unavailable/skipped: reuse stored
  // missingKeywords from the matcher (Phase 2) so we still tailor the resume.
  if (!keywordsToAdd.length) {
    const stored = Array.isArray(job?.missingKeywords) ? job.missingKeywords : [];
    keywordsToAdd = stored.slice(0, 8);
  }

  const mergedSkills = dedupeMerge(baseSkills, keywordsToAdd);

  const pdf = await buildResumePdf({
    name: ctx.profile?.name || '',
    title: ctx.profile?.title || job?.title || '',
    summary: tailoredSummary,
    skills: mergedSkills,
    experience: ctx.experiences.map((e) => ({
      role: e.role,
      company: e.company,
      dates: `${e.startDate || ''} - ${e.endDate || 'Present'}`,
      points: e.bullets || [],
    })),
    education: ctx.educationList.map((e) => `${e.degree}${e.field ? ' in ' + e.field : ''} — ${e.institution}`),
    certifications: ctx.certList.map((c) => `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`),
  });

  const pdfFilename = `${safeSlug(job?.title)}_${safeSlug(job?.company)}_resume.pdf`;
  const kwLabel = keywordsToAdd.length
    ? `Keywords added: ${keywordsToAdd.join(', ')}`
    : 'No new keywords added';
  const content = `ATS Tailored Resume for ${job?.title || ''} at ${job?.company || ''}\n\n${kwLabel}\n\nSkills: ${mergedSkills.join(', ')}`;

  return {
    aiSkipped: false,
    pdf,
    pdfFilename,
    content,
    keywordsMatched: keywordsToAdd,
    jdUsed: jd,
    usedAI,
  };
}

module.exports = { buildTailoredResume, safeSlug, loadProfileContext, dedupeMerge };
