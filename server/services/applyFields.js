const Profile = require('../models/Profile');
const ApplyField = require('../models/ApplyField');
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
 *   2. candidate profile
 *   3. AI (only for non-PII fields), guarded by the AI budget
 * Fields that still have no value become `waitingFields` (user attention).
 *
 * Returns { fieldValues, fieldMeta, waitingFields, usedAI }.
 */
async function resolveFieldValues({ userId, site, detected = [], jobTitle = '' }) {
  const [profile, saved] = await Promise.all([
    Profile.findOne().lean().catch(() => null),
    ApplyField.find({ userId, site }).lean().catch(() => []),
  ]);
  const savedByKey = new Map(saved.map((s) => [s.key, s]));
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
        const answers = await aiAnswerFields({ client, model, fields: aiCandidates, profile, jobTitle });
        usedAI = true;
        recordAICost({ userId, purpose: 'prepare_application' }).catch(() => {});
        for (const f of aiCandidates) {
          const a = answers[f.key];
          if (a?.value) {
            fieldValues[f.key] = a.value;
            fieldMeta[f.key] = { ...f, source: 'ai' };
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

/** One AI call producing a value (and optional suggestion) per unresolved field. */
async function aiAnswerFields({ client, model, fields, profile, jobTitle }) {
  const fieldList = fields.map((f) => `- key: ${f.key}\n  label: ${f.label}\n  type: ${f.type}${f.options?.length ? '\n  options: ' + f.options.join(', ') : ''}`).join('\n');
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
 * future applications on the same site auto-fill (fully automatic).
 */
async function learnFieldValues({ userId, site, fieldValues = {}, fieldMeta = {} }) {
  let learned = 0;
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    const meta = fieldMeta[key] || {};
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
  detectFields,
  fillFields,
  profileFieldMap,
  resolveFieldValues,
  aiAnswerFields,
  learnFieldValues,
  detectApplyFormFields,
};
