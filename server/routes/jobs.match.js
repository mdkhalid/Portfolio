const C = require('./jobs.common');
const { Job, mongoose, UserJobSite, UserSettings, Profile, Skill, Experience, Education, Certification, Project, Activity, Application, ApplyField, crypto, asyncHandler, AppError, strArray, str, int, decrypt, getAdapter, SITE_META, isAutomatedSite, buildDedupeKey, parsePostedDate, getUploadedResumeText, toCanonicalKey, getAIClient, sanitizeJdForAI, emitJobsChanged, getQueue, checkAICost, recordAICost, MAX_FETCH_JOBS, TRACKING_STATUSES, NOT_APPLIED_REASONS, getSearchKeywords, applyBlocklist, fetchFromSite, buildProfileText, fallbackMatch } = C;

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

  const results = { sites: [], total: 0, created: 0, updated: 0, skipped: 0, manualOnly: [], errors: [] };

  for (const site of enabledNames) {
    try {
      const outcome = await fetchFromSite({ userId: req.adminId, site, location, pageCount, maxJobs });
      results.sites.push(outcome);
      results.total += outcome.count;
      results.created += outcome.created;
      results.updated += outcome.updated;
      results.skipped += outcome.skipped;
      if (outcome.manualOnly) results.manualOnly.push(site);
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
    filter.matchScore = null;
  }

  const jobs = await Job.find(filter).limit(limit).lean();
  if (!jobs.length) {
    return res.json({ matched: 0, jobs: [] });
  }

  // AI cost guard: the initial check decides whether AI matching starts at
  // all; the per-job check inside the loop stops AI once the budget is
  // exhausted mid-batch (a single check for up to 50 jobs could overshoot
  // the budget by 49 calls).
  const costCheck = await checkAICost(req.adminId, { purpose: 'match' });
  const useAI = costCheck.allowed;

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
  if (!client || !useAI) {
    // Fallback: simple keyword overlap
    const results = await Promise.all(jobs.map(j => fallbackMatch(j, profileText)));
    for (const r of results) {
      await Job.updateOne({ _id: r.jobId }, { $set: { matchScore: r.score, matchedKeywords: r.matched, missingKeywords: r.missing } });
    }
    return res.json({ matched: results.length, jobs: results });
  }

  const results = [];
  let aiBudgetHit = false;
  for (const job of jobs) {
    try {
      // Per-job budget check: once the AI budget is exhausted, finish the rest
      // of the batch with the deterministic keyword-overlap matcher instead of
      // overshooting the budget.
      if (!aiBudgetHit) {
        const perJobCheck = await checkAICost(req.adminId, { purpose: 'match' });
        if (!perJobCheck.allowed) aiBudgetHit = true;
      }
      if (aiBudgetHit) {
        const fallback = await fallbackMatch(job, profileText);
        await Job.updateOne(
          { _id: job._id },
          { $set: { matchScore: fallback.score, matchedKeywords: fallback.matched, missingKeywords: fallback.missing } }
        );
        results.push(fallback);
        continue;
      }
      const jd = job.description || '';
      if (!jd || jd.trim().length < 20) {
        // Try to fetch full JD if missing (fetch-first; login only as fallback)
        const siteDoc = await UserJobSite.findOne({ userId: req.adminId, name: job.site }).select('+credentials +cookies').lean();
        const adapter = job.site ? getAdapter(job.site) : null;
        const tryFetch = async () => {
          const full = await adapter.fetchJobDescription({ url: job.url });
          return full?.description || full || '';
        };
        if (adapter && job.url) {
          let fetched = '';
          try {
            fetched = await tryFetch();
          } catch (e) {
            console.error(`[match] JD fetch (unauth) failed for ${job.site}:`, e?.message || e);
          }
          if (fetched.length < 20) {
            const creds = siteDoc?.credentials ? decrypt(siteDoc.credentials) : null;
            const cookieHeader = siteDoc?.cookies ? decrypt(siteDoc.cookies)?.value : null;
            try {
              if (cookieHeader) await adapter.login({ cookies: cookieHeader, cookieOrigin: SITE_META[job.site]?.homeUrl || job.url });
              else if (creds?.email && creds?.password) await adapter.login({ email: creds.email, password: creds.password });
              fetched = await tryFetch();
            } catch (e) {
              console.error(`[match] JD fetch (login fallback) failed for ${job.site}:`, e?.message || e);
            }
          }
          if (fetched && fetched.length >= 20) {
            job.description = fetched;
            await Job.updateOne({ _id: job._id }, { $set: { description: fetched } });
          }
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
${sanitizeJdForAI(job.description || jd, 4000)}`;

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

      recordAICost({ userId: req.adminId, purpose: 'match', jobId: job._id }).catch(() => {});
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

  // Push the new scores to the dashboard so cards update without a reload —
  // this also covers long match batches whose HTTP response may be aborted.
  emitJobsChanged(req.adminId);

  res.json({ matched: results.length, jobs: results });
});
