const fs = require('fs');
const path = require('path');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Resume = require('../models/Resume');
const { PDFParse } = require('pdf-parse');
const { getAIClient } = require('../ai/client');
const { sanitizeForAI, sanitizeJdForAI } = require('../utils/security');
const { checkAICost, recordAICost } = require('./aiCost');
const { buildResumePdf, appendKeywordsToResumePdf } = require('./resumePdf');
const { extractDocxText, injectKeywordsIntoDocx } = require('./resumeDocx');

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

/**
 * Pick the master resume. Priority:
 * 1. Explicit isMaster flag (set via "Set as Master" in the admin UI)
 * 2. Label containing national/domestic/main/primary
 * 3. Most recently updated record (falls back to order for legacy records)
 */
function pickMasterResume(resumes) {
  if (!resumes || !resumes.length) return null;
  const flagged = resumes.find((r) => r.isMaster);
  if (flagged) return flagged;
  const byLabel = resumes.find((r) => /national|domestic|main|primary/i.test(r.label));
  if (byLabel) return byLabel;
  const updated = (r) => new Date(r.updatedAt || r.createdAt || 0).getTime();
  return [...resumes].sort((a, b) => updated(b) - updated(a))[0];
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
 * Parse the candidate's uploaded (domestic/default) resume PDF into plain text.
 * The uploaded resume is the single source of truth when it exists — it is
 * richer and more complete than what lives in the profile forms.
 */
async function getUploadedResumeText() {
  try {
    const resumes = await Resume.find().sort({ order: 1 }).lean();
    const chosen = pickMasterResume(resumes);
    if (!chosen || !chosen.fileUrl) return '';
    const fileName = path.basename(chosen.fileUrl);
    const fullPath = path.join(__dirname, '..', 'uploads', fileName);
    if (!fs.existsSync(fullPath)) return '';
    const dataBuffer = fs.readFileSync(fullPath);
    if (/\.docx$/i.test(fileName)) {
      const text = extractDocxText(dataBuffer);
      return text.trim().length >= 200 ? sanitizeForAI(text, { checkInjection: false, maxLen: 0 }) : '';
    }
    const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
    const parsed = await parser.getText();
    parser.destroy();
    const text = parsed?.text || '';
    return text.trim().length >= 200 ? sanitizeForAI(text, { checkInjection: false, maxLen: 0 }) : '';
  } catch (err) {
    console.error('[resumeGenerate] failed to parse uploaded resume:', err?.message || err);
    return '';
  }
}

/**
 * Return the candidate's uploaded (domestic/default) resume PDF bytes, so the
 * original document can be preserved verbatim (we only append matched keywords
 * to it, never rebuild it).
 */
async function getUploadedResumeFile() {
  try {
    const resumes = await Resume.find().sort({ order: 1 }).lean();
    const chosen = pickMasterResume(resumes);
    if (!chosen || !chosen.fileUrl) return null;
    const fileName = path.basename(chosen.fileUrl);
    const fullPath = path.join(__dirname, '..', 'uploads', fileName);
    if (!fs.existsSync(fullPath)) return null;
    return { buffer: fs.readFileSync(fullPath), fileName: chosen.fileUrl, label: chosen.label };
  } catch (err) {
    console.error('[resumeGenerate] failed to read uploaded resume file:', err?.message || err);
    return null;
  }
}

/**
 * Structure the uploaded resume text into the sections buildResumePdf expects
 * (name, title, summary, skills, experience, education, certifications), while
 * adding up to 8 missing JD keywords and weaving 1-3 of them into the summary.
 * Returns null on any failure so callers fall back to the DB profile context.
 */
async function structureAndTailorFromText(resumeText, job, { client, model }) {
  const jd = sanitizeJdForAI(String(job?.description || job?.title || ''), 4000);
  const prompt = `You are converting a candidate's resume into structured JSON for an ATS-friendly PDF. Preserve the candidate's ORIGINAL resume EXACTLY.

CRITICAL RULES:
- Copy EVERY section, heading, experience, role, company, date, and bullet point VERBATIM. Do NOT shorten, summarize, rephrase, reorder, or omit ANY content. The output must be the same length and wording as the original resume.
- Do NOT invent experience, employers, skills, or claims that are not present in the resume.
- Keep the "summary" field EXACTLY as written in the resume. Do NOT rewrite it or weave keywords into it.
- Add missing job-description keywords ONLY to the "skills" array (combined with the resume's existing skills). Do not add keywords to any other field.
- "keywordsAdded": list ONLY the new keywords you added to skills (from the JD, not already present), max 8.

Return ONLY valid JSON:
{
  "name": "<candidate full name>",
  "title": "<current designation/title>",
  "summary": "<professional summary — verbatim from resume>",
  "skills": ["existing skill", "new JD keyword", ...],
  "experience": [{"role": "...", "company": "...", "dates": "...", "points": ["...", "..."]}],
  "education": ["Degree — Institution"],
  "certifications": ["Certification name (issuer)"],
  "keywordsAdded": ["<up to 8 new keywords from the JD not already in the resume>"]
}

CANDIDATE UPLOADED RESUME (preserve verbatim):
${resumeText.slice(0, 30000)}

JOB TITLE: ${job?.title || 'unknown'}

JOB DESCRIPTION:
${jd}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You convert a candidate uploaded resume into structured JSON verbatim and add job keywords only to skills. Return only valid JSON. Never shorten or rewrite content.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 8000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const text = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object') return null;

    const coerceArray = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);
    const experience = Array.isArray(parsed.experience)
      ? parsed.experience
          .filter((e) => e && typeof e === 'object')
          .map((e) => ({
            role: String(e.role || '').trim(),
            company: String(e.company || '').trim(),
            dates: String(e.dates || '').trim(),
            points: Array.isArray(e.points) ? e.points.map((p) => String(p || '').trim()).filter(Boolean) : [],
          }))
          .filter((e) => e.role || e.company)
      : [];

    const skills = coerceArray(parsed.skills);
    if (!skills.length) return null;

    return {
      name: String(parsed.name || '').trim(),
      title: String(parsed.title || '').trim(),
      summary: String(parsed.summary || '').trim(),
      skills,
      experience,
      education: coerceArray(parsed.education),
      certifications: coerceArray(parsed.certifications),
      keywordsAdded: coerceArray(parsed.keywordsAdded).slice(0, 8),
    };
  } catch (err) {
    console.error('[resumeGenerate] resume structuring/tailoring failed:', err?.message || err);
    return null;
  }
}

/**
 * Lightweight AI call: up to 8 missing JD keywords for this resume. Used by
 * the DOCX path where keywords are injected into the existing Skills section
 * (AI never touches layout or content, it only suggests terms).
 */
async function suggestMissingKeywords(resumeText, job, { client, model }) {
  const jd = sanitizeJdForAI(String(job?.description || job?.title || ''), 4000);
  if (!client || jd.length < 30) return [];
  const prompt = `You are an ATS keyword analyst. Compare the candidate's resume against the job description.

Return ONLY valid JSON: { "keywords": ["...", "..."] }

Rules:
- Up to 8 missing tech skills, tools, frameworks, or domain terms that the JD requires and the resume does NOT already contain.
- Never include terms that already appear anywhere in the resume.
- No generic words (e.g. "communication", "teamwork").

RESUME:
${resumeText.slice(0, 20000) || '(not available)'}

JOB DESCRIPTION:
${jd}`;
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an ATS keyword analyst. Return only valid JSON with a "keywords" array.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    return (Array.isArray(parsed.keywords) ? parsed.keywords : [])
      .map((k) => String(k || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch (err) {
    console.error('[resumeGenerate] keyword suggestion failed:', err?.message || err);
    return [];
  }
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
  const jd = sanitizeJdForAI(String(job?.description || job?.title || ''), 4000);

  const { client, model } = await getAIClient('ats');
  const costCheck = await checkAICost(userId, { purpose: 'generate_resume' });
  const budgetOk = costCheck.allowed;

  if (skipOnBudgetExceeded && !budgetOk) {
    return { aiSkipped: true, reason: costCheck.reason };
  }

  // PRIMARY: preserve the candidate's ORIGINAL uploaded resume PDF exactly and
  // only APPEND the matched job-description keywords to it. We never rebuild the
  // document, so the original formatting/layout/content is kept 100% — only the
  // keyword list changes. Falls back to the DB profile context (buildResumePdf)
  // below when there is no uploaded file.
  const uploadedText = await getUploadedResumeText();
  const uploadedFile = await getUploadedResumeFile();
  if (uploadedFile) {
    // DOCX master: inject JD keywords INTO the existing Skills section. The
    // candidate's formatting/layout is preserved — we edit only that section
    // and clone existing skill entries so style matches exactly.
    if (/\.docx$/i.test(uploadedFile.fileName || '')) {
      const pdfFilename = `${safeSlug(job?.title)}_${safeSlug(job?.company)}_resume.docx`;
      let keywords = [];
      let usedAI = false;
      if (client && budgetOk) {
        keywords = await suggestMissingKeywords(uploadedText, job, { client, model });
        if (keywords.length) {
          usedAI = true;
          recordAICost({ userId, purpose: 'generate_resume', jobId: job?._id || null }).catch(() => {});
        }
      }
      if (!keywords.length) {
        keywords = (Array.isArray(job?.missingKeywords) ? job.missingKeywords : []).slice(0, 8);
      }
      const injected = keywords.length
        ? await injectKeywordsIntoDocx(uploadedFile.buffer, keywords)
        : { ok: true, buffer: uploadedFile.buffer, inserted: [] };
      if (injected.ok) {
        return {
          aiSkipped: false,
          pdf: injected.buffer,
          pdfFilename,
          content: injected.inserted.length
            ? `Original resume preserved. Keywords added to Skills section: ${injected.inserted.join(', ')}`
            : 'Original resume preserved (no new keywords required).',
          keywordsMatched: injected.inserted,
          jdUsed: jd,
          usedAI,
        };
      }
      // Skills section not detected — never risk the document; return it unchanged.
      return {
        aiSkipped: false,
        pdf: uploadedFile.buffer,
        pdfFilename,
        content: `Original resume preserved (Skills section not detected: ${injected.reason || 'unknown'}).`,
        keywordsMatched: [],
        jdUsed: jd,
        usedAI: false,
      };
    }

    let keywordsAdded = [];
    let structured = null;
    if (client && budgetOk) {
      structured = await structureAndTailorFromText(uploadedText, job, { client, model });
      if (structured && Array.isArray(structured.keywordsAdded)) {
        keywordsAdded = structured.keywordsAdded.slice(0, 8);
      }
    }
    if (!keywordsAdded.length) {
      keywordsAdded = (Array.isArray(job?.missingKeywords) ? job.missingKeywords : []).slice(0, 8);
    }

    const pdfFilename = `${safeSlug(job?.title)}_${safeSlug(job?.company)}_resume.pdf`;

    // PRIMARY (AI available + resume structured): rebuild a clean ATS PDF with the
    // JD keywords merged INTO the Skills section — not a separate page.
    if (structured && structured.skills && structured.skills.length) {
      if (client && budgetOk) {
        recordAICost({ userId, purpose: 'generate_resume', jobId: job?._id || null }).catch(() => {});
      }
      const pdf = await buildResumePdf({
        name: structured.name,
        title: structured.title || job?.title || '',
        summary: structured.summary,
        skills: structured.skills,
        experience: structured.experience,
        education: structured.education,
        certifications: structured.certifications,
      });
      return {
        aiSkipped: false,
        pdf,
        pdfFilename,
        content: `Resume rebuilt with ${keywordsAdded.length} keyword(s) merged into the Skills section: ${keywordsAdded.join(', ')}`,
        keywordsMatched: keywordsAdded,
        jdUsed: jd,
        usedAI: !!(client && budgetOk),
      };
    }

    // FALLBACK (could not structure the resume, e.g. a scanned/image PDF): append
    // the keyword list as a Skills addendum so the keywords still reach the file.
    if (keywordsAdded.length) {
      if (client && budgetOk) {
        recordAICost({ userId, purpose: 'generate_resume', jobId: job?._id || null }).catch(() => {});
      }
      const pdf = await appendKeywordsToResumePdf(uploadedFile.buffer, keywordsAdded, job);
      return {
        aiSkipped: false,
        pdf,
        pdfFilename,
        content: `Original resume preserved. Keywords added: ${keywordsAdded.join(', ')}`,
        keywordsMatched: keywordsAdded,
        jdUsed: jd,
        usedAI: !!(client && budgetOk),
      };
    }

    // No new keywords required — return the original resume PDF unchanged.
    return {
      aiSkipped: false,
      pdf: uploadedFile.buffer,
      pdfFilename,
      content: 'Original resume preserved (no new keywords required).',
      keywordsMatched: [],
      jdUsed: jd,
      usedAI: false,
    };
  }

  // FALLBACK: DB profile context (existing behavior).
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

module.exports = { buildTailoredResume, safeSlug, loadProfileContext, dedupeMerge, pickMasterResume };
