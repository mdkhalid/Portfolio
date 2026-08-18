const Profile = require('../models/Profile');
const ApplyField = require('../models/ApplyField');
const Application = require('../models/Application');
const { getAIClient } = require('../ai/client');
const { checkAICost, recordAICost } = require('./aiCost');
const { withPage, delay } = require('../adapters/browser');

// Field types that must NEVER be invented by AI (identifying / sensitive).
const PII_TYPES = new Set(['email', 'tel', 'password']);

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

/**
 * Map dynamic questions/labels to cross-platform canonical semantic keys.
 */
function toCanonicalKey(label = '', key = '') {
  const text = `${label} ${key}`.toLowerCase();
  if (/notice|how soon|availability|join|start date/i.test(text)) return 'notice_period';
  if (/sponsor|visa|work auth|authorized to work|eligible to work/i.test(text)) return 'work_authorization';
  if (/expected (salary|ctc|pay|compensation)|salary expectation|target salary/i.test(text)) return 'expected_ctc';
  if (/current (salary|ctc|pay|compensation)/i.test(text)) return 'current_ctc';
  if (/relocate|willing to relocate|relocation/i.test(text)) return 'willing_to_relocate';
  if (/total (years of )?exp|years of experience|overall exp/i.test(text)) return 'years_of_experience';
  if (/gender|pronoun/i.test(text)) return 'gender';
  if (/linkedin/i.test(text)) return 'linkedin_url';
  if (/github/i.test(text)) return 'github_url';
  if (/portfolio|website/i.test(text)) return 'portfolio_url';
  if (/headline|summary|about you|tell us about/i.test(text)) return 'about_summary';
  return slugify(label || key);
}

function resolveLabel(el) {
  if (el.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (forLabel) return (forLabel.textContent || '').trim();
  }
  const wrap = el.closest('label');
  if (wrap) return (wrap.textContent || '').trim();
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const ph = el.getAttribute('placeholder');
  if (ph) return ph.trim();
  const name = el.getAttribute('name');
  return name ? name.replace(/[_\[\]]+/g, ' ').trim() : '';
}

function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${name}"]`;
  const type = el.getAttribute('type');
  if (type) return `${tag}[type="${type}"]`;
  return tag;
}

/**
 * Generic best-effort form-field detection. Scans visible text-ish inputs,
 * selects, and textareas on the current page and pairs them with labels.
 * Returns [{ key, label, type, selector, options }].
 */
async function detectFields(page) {
  try {
    return await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      const els = Array.from(document.querySelectorAll('input, select, textarea'));
      for (const el of els) {
        const type = el.tagName.toLowerCase() === 'select'
          ? 'select'
          : el.tagName.toLowerCase() === 'textarea'
            ? 'textarea'
            : (el.type || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'image', 'file', 'reset'].includes(type)) continue;
        if (type === 'checkbox' || type === 'radio') continue;

        const name = (el.getAttribute('name') || el.id || '').trim();
        const label = resolveLabel(el);
        const key = slugify(label || name || type);
        if (!key || key.length < 2 || seen.has(key)) continue;
        seen.add(key);

        let options = [];
        if (type === 'select') {
          options = Array.from(el.options)
            .map((o) => (o.textContent || '').trim())
            .filter(Boolean);
        }
        out.push({ key, label: label || name || type, type, selector: buildSelector(el), options });
      }
      return out;
    });
  } catch {
    return [];
  }
}

/**
 * Fill the detected apply-form fields with the resolved values. Best-effort:
 * a field that can't be located is skipped (never throws for one field).
 */
async function fillFields(page, fieldValues = {}, detected = []) {
  let filled = 0;
  for (const f of detected) {
    const value = fieldValues[f.key];
    if (value === undefined || value === null || value === '') continue;
    try {
      const done = await page.evaluate((sel, val, type, opts) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const setVal = (node, v) => {
          const proto = node instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : node instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(node, v);
          node.dispatchEvent(new Event('input', { bubbles: true }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        };
        if (type === 'select') {
          const optsArr = opts || [];
          const option = [...el.options].find((o) => o.text.trim() === val || o.value === val);
          if (option) {
            setVal(el, option.value);
            return true;
          }
          if (el.options.length && optsArr.includes(val)) {
            setVal(el, val);
            return true;
          }
          return false;
        }
        return setVal(el, val);
      }, f.selector, value, f.type, f.options);
      if (done) filled++;
    } catch {
      // skip this field
    }
  }
  return filled;
}

/** Stable profile-derived values for the most common apply-form fields. */
function profileFieldMap(profile = {}) {
  const city = String(profile.location || '').split(',')[0].trim();
  const map = {
    name: profile.name,
    full_name: profile.name,
    fullname: profile.name,
    email: profile.email,
    phone: profile.phone,
    mobile: profile.phone,
    mobile_number: profile.phone,
    contact: profile.phone,
    location: profile.location,
    current_location: profile.location,
    city,
    current_city: city,
    current_title: profile.title,
    title: profile.title,
    years_of_experience: profile.experienceYears ? String(profile.experienceYears) : '',
    years_experience: profile.experienceYears ? String(profile.experienceYears) : '',
    experience: profile.experienceYears ? String(profile.experienceYears) : '',
    total_experience: profile.experienceYears ? String(profile.experienceYears) : '',
    linkedin: profile.linkedIn,
    linkedin_url: profile.linkedIn,
    github: profile.github,
    github_url: profile.github,
  };
  return map;
}

/**
 * Resolve answers for the detected fields, in priority order:
 *   1. learned knowledge base (ApplyField, per user+site)
 *   2. canonical cross-site memory (same semantic question answered on ANY site)
 *   3. candidate profile
 *   4. AI (only for non-PII fields), guarded by the AI budget
 * Fields that still have no value become `waitingFields` (user attention).
 *
 * Returns { fieldValues, fieldMeta, waitingFields, usedAI }.
 */
async function resolveFieldValues({ userId, site, detected = [], jobTitle = '' }) {
  // Fetch site-specific AND all-site learned answers in one pass so a value
  // learned on Indeed can auto-fill the same semantic question on Naukri.
  const [profile, saved, allLearned] = await Promise.all([
    Profile.findOne().lean().catch(() => null),
    ApplyField.find({ userId, site }).lean().catch(() => []),
    ApplyField.find({ userId, canonicalKey: { $ne: '' } }).lean().catch(() => []),
  ]);
  const savedByKey = new Map(saved.map((s) => [s.key, s]));
  const learnedByCanonical = new Map();
  for (const row of allLearned) {
    if (!row.canonicalKey || !row.value) continue;
    const prev = learnedByCanonical.get(row.canonicalKey);
    // Prefer the most-used answer for the canonical concept.
    if (!prev || (row.timesUsed || 0) > (prev.timesUsed || 0)) learnedByCanonical.set(row.canonicalKey, row);
  }
  const profileMap = profileFieldMap(profile || {});

  const fieldValues = {};
  const fieldMeta = {};
  const waitingFields = [];
  const aiCandidates = [];

  for (const f of detected) {
    const learned = savedByKey.get(f.key);
    if (learned?.value) {
      fieldValues[f.key] = learned.value;
      fieldMeta[f.key] = { ...f, source: 'saved' };
      continue;
    }
    // Cross-site memory: same question asked with a different label elsewhere.
    const canonical = toCanonicalKey(f.label, f.key);
    const crossSite = learnedByCanonical.get(canonical);
    if (crossSite?.value) {
      fieldValues[f.key] = crossSite.value;
      fieldMeta[f.key] = { ...f, source: 'saved', canonicalKey: canonical, learnedFrom: crossSite.site };
      continue;
    }
    const pf = profileMap[f.key] || profileMap[f.type];
    if (pf) {
      fieldValues[f.key] = pf;
      fieldMeta[f.key] = { ...f, source: 'profile' };
      continue;
    }
    // Never let AI invent identifying info.
    if (PII_TYPES.has(f.type)) {
      waitingFields.push({ ...f, value: '', suggestion: '' });
      continue;
    }
    aiCandidates.push(f);
  }

  let usedAI = false;
  if (aiCandidates.length) {
    const { client, model } = await getAIClient('chat');
    const costCheck = await checkAICost(userId, { purpose: 'prepare_application' });
    if (client && costCheck.allowed) {
      try {
        const fewShot = await buildFewShotContext(userId);
        const answers = await aiAnswerFields({ client, model, fields: aiCandidates, profile, jobTitle, fewShot });
        usedAI = true;
        recordAICost({ userId, purpose: 'prepare_application' }).catch(() => {});
        for (const f of aiCandidates) {
          const a = answers[f.key];
          if (a?.value) {
            fieldValues[f.key] = a.value;
            // Mark answers reused from a prior apply distinctly from fresh AI.
            const source = fewShot.some((p) => p.value === a.value && (p.key === f.key || p.label === f.label))
              ? 'ai_fewshot'
              : 'ai';
            fieldMeta[f.key] = { ...f, source };
          } else {
            waitingFields.push({ ...f, value: '', suggestion: a?.suggestion || '' });
          }
        }
      } catch (err) {
        // Budget/AI failure → leave unresolved for user attention.
        console.error('[applyFields] AI answer failed:', err?.message || err);
        for (const f of aiCandidates) {
          waitingFields.push({ ...f, value: '', suggestion: '' });
        }
      }
    } else {
      for (const f of aiCandidates) {
        waitingFields.push({ ...f, value: '', suggestion: '' });
      }
    }
  }

  return { fieldValues, fieldMeta, waitingFields, usedAI };
}

/**
 * Build a compact few-shot context from the candidate's prior applications:
 * for each field that was actually answered, pair the semantic key with the
 * value. Reuses the most recent successful/queued applies so the model can
 * answer the same question the same way across providers.
 */
async function buildFewShotContext(userId, limit = 8) {
  const prior = await Application.find({
    userId,
    status: { $in: ['applied', 'queued', 'running', 'pending', 'passed'] },
    'detectedFields.0': { $exists: true },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()
    .catch(() => []);

  const seen = new Map();
  for (const app of prior) {
    const values = app.fieldValues instanceof Map
      ? Object.fromEntries(app.fieldValues)
      : (app.fieldValues || {});
    const detected = app.detectedFields || [];
    for (const f of detected) {
      const value = values[f.key];
      if (value && !seen.has(f.key)) {
        seen.set(f.key, { key: f.key, label: f.label || f.key, value });
      }
    }
  }
  return [...seen.values()];
}

/** One AI call producing a value (and optional suggestion) per unresolved field. */
async function aiAnswerFields({ client, model, fields, profile, jobTitle, fewShot = [] }) {
  const fieldList = fields.map((f) => `- key: ${f.key}\n  label: ${f.label}\n  type: ${f.type}${f.options?.length ? '\n  options: ' + f.options.join(', ') : ''}`).join('\n');
  const fewShotText = fewShot.length
    ? fewShot.map((f) => `- ${f.key} (${f.label}): ${f.value}`).join('\n')
    : '(none — answer from profile only)';
  const prompt = `You are filling in a job application form for the candidate described below. Only provide TRUE, defensible answers derived from the candidate's profile and the job title. For every field give a value; if you genuinely cannot answer a field, set "value": "" and give a short "suggestion" describing what the candidate should provide.

CRITICAL RULES:
- Never invent personal details (email, phone, links the candidate doesn't have).
- For numeric fields (experience years), use the profile's experience years.
- For opinion/essay fields (e.g. "Why do you want this job", "Cover letter"), write a concise 1-3 sentence professional answer referencing the job title.
- For selects/radios, only pick from the listed options.
- If the field has "options" and none fit, leave value empty.

Return ONLY valid JSON like:
{"FIELD_KEY": {"value": "...", "suggestion": ""}}

CANDIDATE PROFILE:
Name: ${profile?.name || ''}
Current title: ${profile?.title || ''}
Location: ${profile?.location || ''}
Years of experience: ${profile?.experienceYears ?? ''}
Summary: ${(profile?.summary || '').slice(0, 600)}

PREVIOUS ANSWERS (reuse when the semantic question matches):
${fewShotText}

JOB TITLE: ${jobTitle || 'unknown'}

FIELDS TO FILL:
${fieldList}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You fill job-application forms truthfully from a candidate profile. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  const text = completion.choices?.[0]?.message?.content;
  const parsed = JSON.parse(text || '{}');
  const out = {};
  for (const f of fields) {
    const a = parsed[f.key];
    if (a && typeof a === 'object') {
      out[f.key] = {
        value: String(a.value ?? '').trim(),
        suggestion: String(a.suggestion ?? '').trim(),
      };
    }
  }
  return out;
}

/**
 * Learn resolved values into the knowledge base after a successful submit, so
 * future applications on ANY site auto-fill (fully automatic). Each answer is
 * saved with both the site-specific key and a canonical semantic key, enabling
 * cross-site reuse of answers to equivalent questions.
 */
async function learnFieldValues({ userId, site, fieldValues = {}, fieldMeta = {} }) {
  let learned = 0;
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    const meta = fieldMeta[key] || {};
    const canonicalKey = meta.canonicalKey || toCanonicalKey(meta.label || '', key);
    try {
      await ApplyField.updateOne(
        { userId, site, key },
        {
          $set: {
            label: meta.label || '',
            type: meta.type || 'text',
            selector: meta.selector || '',
            options: meta.options || [],
            value,
            source: meta.source || 'ai',
            canonicalKey,
          },
          $inc: { timesUsed: 1 },
        },
        { upsert: true }
      );
      learned++;
    } catch {
      // ignore per-field failure
    }
  }
  return learned;
}

/**
 * Open a job's apply form (best-effort) and detect its fields without
 * submitting. Uses the shared browser; returns the detected field list (or []).
 * `applySelectors` are the site-specific apply-button selectors.
 */
async function detectApplyFormFields({ url, applySelectors = [], waitAfterClick = 3500 }) {
  if (!url) return [];
  return withPage(async (page) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(2500);
      let clicked = false;
      for (const sel of applySelectors) {
        const btn = await page.$(sel);
        if (btn) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
            btn.click().catch(() => {}),
          ]);
          clicked = true;
          break;
        }
      }
      if (!clicked) return [];
      await delay(waitAfterClick);
      return await detectFields(page);
    } catch {
      return [];
    }
  });
}

module.exports = {
  slugify,
  toCanonicalKey,
  detectFields,
  fillFields,
  profileFieldMap,
  resolveFieldValues,
  aiAnswerFields,
  buildFewShotContext,
  learnFieldValues,
  detectApplyFormFields,
};
