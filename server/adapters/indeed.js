const { withPage, safeText, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick } = require('./browser');
const { detectApplyFormFields, fillFields } = require('../services/applyFields');

const BASE = 'https://www.indeed.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Log in to Indeed. Prefers a pasted session cookie header (fallback when
 * Google/Apple SSO or CAPTCHA blocks programmatic login); otherwise attempts
 * the email/password form and returns a structured error if blocked.
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    const ok = await withPage(async (page) => {
      const isLoggedIn = await loginWithCookies(page, cookies, cookieOrigin, async (p) => {
        const url = p.url();
        const loggedOut = await p.$('a[href*="/account/login"], a[data-testid="login-link"]');
        return !(url.includes('login') || loggedOut);
      });
      return isLoggedIn;
    }, 'indeed');
    if (ok) return { ok: true, via: 'cookies' };
    // Cookie present but didn't authenticate → it's expired/invalid. Without
    // credentials there's no point falling through to a doomed password login
    // that would only surface a confusing Puppeteer selector-timeout error.
    if (!email || !password) {
      throw new Error('Indeed session cookie is invalid or expired — use the Login via Browser button in the Job Sites tab to reconnect.');
    }
  }

  return withPage(async (page) => {
    await page.goto(`${BASE}/account/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Attempt the email/password form if present.
    const hasForm = !!(await page.$('input[name="email"], input[name="login-email"], input[type="email"]'));
    if (!hasForm) {
      throw new Error('Indeed login uses Google/Apple SSO or CAPTCHA and cannot be automated. Log in manually, then paste your session cookie.');
    }
    const emailSel = 'input[name="email"], input[name="login-email"], input[type="email"]';
    const pwSel = 'input[type="password"]';
    await page.type(emailSel, email, { delay: 20 });
    await page.type(pwSel, password, { delay: 20 });
    const submitBtn = await page.$('button[type="submit"], button[data-testid="login-button"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      submitBtn ? safeClick(page, submitBtn, 'login submit') : page.keyboard.press('Enter'),
    ]);
    if (page.url().includes('login')) {
      throw new Error('Indeed login failed — SSO/CAPTCHA required. Log in manually, then paste your session cookie.');
    }
    return { ok: true, via: 'password' };
  }, 'indeed');
}

/**
 * Search Indeed for jobs matching keywords. Returns a normalized job list.
 * Public search works without login for the listing (details/apply may need it).
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  const q = normalize(query).split(/\s+/).slice(0, 4).join('+');
  const params = new URLSearchParams({ q });
  if (location) params.set('l', location);
  const url = `${BASE}/jobs?${params.toString()}`;
  return withPage(async (page) => {
    // Set extra headers to bypass automated browser detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    const jobs = [];
    const seen = new Set();
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('[data-testid="pagination-page-next"] a, a[aria-label="Next Page"], a[aria-label="Next"]');
        if (!next) break;
        await safeClick(page, next, 'next');
        await delay(2500);
      }
      const items = await page.$$('.job_seen_beacon, td.resultContent, .slider_item');
      for (const item of items) {
        if (jobs.length >= maxJobs) break;
        try {
          // The same card is matched by several nested selectors; dedupe on jk.
          const jk = await item.$eval('a[data-jk]', (el) => el.getAttribute('data-jk') || '').catch(() => '');
          if (jk && seen.has(jk)) continue;
          if (jk) seen.add(jk);

          const title = await item.$eval('h2 a, .jcs-JobTitle, a[data-jk], a[id^="job_"]', (el) => el.textContent.trim()).catch(() => '');
          const urlHref = await item.$eval('h2 a, .jcs-JobTitle, a[data-jk], a[id^="job_"]', (el) => el.getAttribute('href') || '').catch(() => '');
          const company = await safeText(item, '[data-testid="company-name"], .companyName, .company, [data-company-name], [class*="company"]');
          const locationEl = await safeText(item, '[data-testid="text-location"], .location, .companyLocation, [data-testid="job-location"], [class*="location"]');
          const posted = await safeText(item, '[data-testid="myJobsStateDate"], .date, [class*="date"], .jobsearch-JobMetadataFooter');
          if (title) {
            const rawUrl = urlHref ? (urlHref.startsWith('http') ? urlHref : `${BASE}${urlHref}`) : '';
            jobs.push({
              title: normalize(title),
              company: normalize(company) || 'Confidential',
              location: normalize(locationEl),
              url: jk ? `${BASE}/viewjob?jk=${encodeURIComponent(jk)}` : rawUrl,
              postedText: normalize(posted),
              siteJobId: jk || '',
              site: 'indeed',
            });
          }
        } catch {
          // skip malformed card
        }
      }
    }
    return jobs;
  }, 'indeed');
}

/** Fetch the full job description for an Indeed job URL. Accepts a URL string or { url }. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);
    return await safeText(page, '#jobDescriptionText, [data-testid="jobDescriptionText"]');
  }, 'indeed');
}

/**
 * Detect the apply form fields for an Indeed job (best-effort, no submit).
 * Returns [{ key, label, type, selector, options }] or [].
 */
async function detectApplyFields({ url }) {
  return detectApplyFormFields({
    url,
    applySelectors: ['button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"], a[class*="apply"]'],
  });
}

/**
 * Submit an application for an Indeed job.
 * Opens the job page, clicks the primary Apply button, walks the apply wizard
 * (Continue/Next → resume upload → Submit), and confirms. External employer
 * redirects throw so the worker routes the job to Manual Apply.
 * Returns { ok: true, applied } or throws a structured error.
 */
async function submitApplication({ url, credentials, resume, resumeFilename, fields, detected }) {
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    const applyBtn = await page.$('button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"], a[class*="apply"]');
    if (!applyBtn) {
      const hasLogin = await page.$('a[href*="/account/login"], input[name="email"]');
      if (hasLogin) throw new Error('Login required — save credentials or paste a session cookie for Indeed.');
      throw new Error('No apply button found on this Indeed job (may redirect to employer site).');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      safeClick(page, applyBtn, 'apply'),
    ]);
    await delay(3500);

    // External employer application — can't be automated beyond the click.
    const urlNow = page.url();
    if (!urlNow.includes('indeed.com')) {
      throw new Error('Indeed redirected to an employer site — complete the application manually.');
    }

    // Walk the Indeed apply wizard: fill fields, upload resume, click Continue/Next/Submit.
    for (let i = 0; i < 6; i++) {
      if (fields && detected?.length) {
        await fillFields(page, fields, detected).catch(() => {});
      }
      if (resume) {
        await uploadResumeFile(page, resume, resumeFilename).catch(() => {});
      }
      const clicked = await clickButtonByText(page, ['continue', 'next', 'submit application', 'submit', 'save and continue']);
      if (!clicked) break;
      await delay(1800);
    }

    // Verify the application actually went through — Indeed replaces the apply
    // button with success text or disables it on the modal.
    const state = await readApplyState(page, 'button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"]');
    return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
  }, 'indeed');
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields };
