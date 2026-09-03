const express = require('express');
const mongoose = require('mongoose');
const Job = require('../models/Job');
const GeneratedResume = require('../models/GeneratedResume');
const Application = require('../models/Application');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { getAIClient } = require('../ai/client');
const { str } = require('../middleware/validate');
const { sanitizeJdForAI } = require('../utils/security');
const { checkAICost, recordAICost } = require('../services/aiCost');
const { buildTailoredResume } = require('../services/resumeGenerate');
const { emitJobsChanged } = require('../services/notifications');

const router = express.Router();

/**
 * POST /api/resume/optimize
 * Body: { jobId: string }
 * Returns keyword suggestions to improve the match score against the given JD.
 */
router.post('/optimize', asyncHandler(async (req, res) => {
  const jobId = str(req.body, 'jobId', { min: 1, max: 100 });
  const job = await Job.findOne({ _id: jobId, userId: req.adminId }).lean();
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

  const { client, model } = await getAIClient('ats');
  const costCheck = await checkAICost(req.adminId, { purpose: 'optimize' });
  if (!client || !costCheck.allowed) {
    return res.json({
      suggestions: [],
      note: !client ? 'AI API key not configured. Keyword suggestions unavailable.' : costCheck.reason,
    });
  }

  const prompt = `Analyze this job description and return ONLY valid JSON:
{
  "suggestions": [
    { "keyword": "TypeScript", "section": "Skills", "reason": "Mentioned as a required tool in the JD" }
  ]
}
Return up to 8 suggestions that a candidate should add to their resume to improve the match score. Include missing tech skills, tools, frameworks, or domain-specific terms.

JOB DESCRIPTION:
${sanitizeJdForAI(job.description || job.title, 4000)}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are an expert ATS resume optimizer. Return only valid JSON with a suggestions array.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 800,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices?.[0]?.message?.content;
  let suggestions = [];
  try {
    const parsed = JSON.parse(text || '{}');
    suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [];
  } catch {
    suggestions = [];
  }

  recordAICost({ userId: req.adminId, purpose: 'optimize', jobId }).catch(() => {});
  res.json({ jobId, suggestions });
}));

/**
 * POST /api/resume/cover-letter
 * Body: { jobId: string }
 * Generates an AI cover letter for the job using profile + resume context.
 */
router.post('/cover-letter', asyncHandler(async (req, res) => {
  const jobId = str(req.body, 'jobId', { min: 1, max: 100 });
  const job = await Job.findOne({ _id: jobId, userId: req.adminId }).lean();
  if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

  const { client, model } = await getAIClient('chat');
  const costCheck = await checkAICost(req.adminId, { purpose: 'cover_letter' });
  if (!client) {
    throw new AppError('AI API key not configured. Cover letter generation unavailable.', 400, 'AI_NOT_CONFIGURED');
  }
  if (!costCheck.allowed) {
    throw new AppError(costCheck.reason, 429, 'AI_BUDGET_EXCEEDED');
  }

  const prompt = `Write a professional, concise cover letter (250-350 words) for this job application.
Customize it for the specific role and company. Highlight relevant experience, skills, and enthusiasm.

Role: ${job.title}
Company: ${job.company}
Location: ${job.location || 'N/A'}
Job Description:
${sanitizeJdForAI(job.description || '', 3500)}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are an expert career coach writing tailored cover letters. Return plain text only (no JSON).' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.7,
  });

  const coverLetter = completion.choices?.[0]?.message?.content?.trim() || '';

  recordAICost({ userId: req.adminId, purpose: 'cover_letter', jobId }).catch(() => {});
  res.json({ jobId, coverLetter });
}));

/**
 * POST /api/resume/generate
 * Body: { jobId: string } or { jobIds: string[] }
 * Generates a tailored, ATS-friendly resume per job that merges JD keywords into
 * the Skills list and weaves the most important ones into the Summary — WITHOUT
 * changing the resume structure. Persists a GeneratedResume and attaches it to
 * the job (Job.resumeId) so Auto-Apply reuses it.
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const jobId = str(req.body, 'jobId', { min: 1, max: 100, optional: true });
  let jobIds = Array.isArray(req.body?.jobIds) ? req.body.jobIds : null;
  if (!jobId && !jobIds) throw new AppError('jobId or jobIds required', 400, 'MISSING_JOB_IDS');
  if (jobId && !jobIds) jobIds = [jobId];
  jobIds = jobIds.slice(0, 20);

  const results = [];
  for (const id of jobIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      results.push({ jobId: id, error: 'invalid_id' });
      continue;
    }
    const job = await Job.findOne({ _id: id, userId: req.adminId }).lean();
    if (!job) {
      results.push({ jobId: id, error: 'not_found' });
      continue;
    }
    try {
      // If this job already has a tailored resume (generated earlier but not yet
      // applied, e.g. the apply failed or needs manual action), reuse it instead
      // of spending AI budget regenerating the same document.
      if (job.resumeId) {
        const existing = await GeneratedResume.findOne({ _id: job.resumeId, deletedAt: null }).select('+pdf').lean().catch(() => null);
        if (existing && existing.pdf && existing.pdf.length) {
          results.push({
            jobId: job._id,
            resumeId: existing._id,
            pdfFilename: existing.pdfFilename,
            keywordsAdded: Array.isArray(existing.keywordsMatched) ? existing.keywordsMatched.length : 0,
            reused: true,
            usedAI: false,
          });
          continue;
        }
      }
      const built = await buildTailoredResume(job, { userId: req.adminId });
      const app = await Application.findOne({ userId: req.adminId, jobId: job._id })
        .sort({ createdAt: -1 })
        .lean();
      const gen = await GeneratedResume.create({
        userId: req.adminId,
        jobId: job._id,
        applicationId: app?._id || null,
        content: built.content,
        pdf: built.pdf,
        pdfFilename: built.pdfFilename,
        jdUsed: built.jdUsed,
        keywordsMatched: built.keywordsMatched,
        costBucket: new Date().toISOString().slice(0, 10),
      });
      await Job.updateOne({ _id: job._id }, { $set: { resumeId: gen._id } });
      results.push({
        jobId: job._id,
        resumeId: gen._id,
        pdfFilename: built.pdfFilename,
        keywordsAdded: built.keywordsMatched.length,
        usedAI: built.usedAI,
      });
    } catch (err) {
      results.push({ jobId: id, error: String(err?.message || 'failed').slice(0, 200) });
    }
  }

  emitJobsChanged(req.adminId);

  res.json({ generated: results.filter((r) => !r.error).length, results });
}));

// ─── Generated Resume Management (Phase 4) ───────────────────────────────────

/** GET /api/resume/generated — list generated resumes (optionally ?applicationId=) */
router.get('/generated', asyncHandler(async (req, res) => {
  const { applicationId } = req.query;
  const filter = { userId: req.adminId, deletedAt: null };
  if (applicationId) filter.applicationId = applicationId;
  const items = await GeneratedResume.find(filter)
    .sort({ createdAt: -1 })
    .select('-pdf')
    .lean();
  res.json(items);
}));

/** GET /api/resume/generated/:id — full record incl. content (no pdf buffer) */
router.get('/generated/:id', asyncHandler(async (req, res) => {
  const item = await GeneratedResume.findOne({ _id: req.params.id, userId: req.adminId, deletedAt: null })
    .select('-pdf')
    .lean();
  if (!item) throw new AppError('Resume not found', 404, 'NOT_FOUND');
  res.json(item);
}));

/** GET /api/resume/generated/:id/pdf — download the PDF (?inline=1 previews it in a browser tab). */
router.get('/generated/:id/pdf', asyncHandler(async (req, res) => {
  const item = await GeneratedResume.findOne({ _id: req.params.id, userId: req.adminId, deletedAt: null })
    .select('+pdf');
  if (!item) throw new AppError('Resume not found', 404, 'NOT_FOUND');
  if (!item.pdf || !item.pdf.length) throw new AppError('No PDF available for this resume', 404, 'NO_PDF');
  const isDocx = /\.docx$/i.test(item.pdfFilename || '');
  res.setHeader(
    'Content-Type',
    isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf'
  );
  // Browsers render an inline PDF natively — used by the "View" preview button.
  // DOCX can't be rendered, so it always downloads.
  const inline = req.query.inline === '1' && !isDocx;
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${item.pdfFilename || 'resume.pdf'}"`);
  res.send(item.pdf);
}));

/** DELETE /api/resume/generated/:id — soft delete */
router.delete('/generated/:id', asyncHandler(async (req, res) => {
  const item = await GeneratedResume.findOneAndUpdate(
    { _id: req.params.id, userId: req.adminId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );
  if (!item) throw new AppError('Resume not found', 404, 'NOT_FOUND');
  res.json({ message: 'Resume deleted' });
}));

module.exports = router;
