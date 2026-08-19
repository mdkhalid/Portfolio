const { withPage, safeText, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick } = require('./browser');
const { detectApplyFormFields, fillFields } = require('../services/applyFields');

const BASE = 'https://www.naukri.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Sanitize a query string for safe use in a Naukri URL path. */
function urlSafeQuery(query) {
  return normalize(query)
    .toLowerCase()
    .replace(/[.#+]/g, ' ')   // C# -> C, .NET -> NET, React.js -> React js
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 8)              // Naukri URLs work best with a few keywords
    .join('-');
}

/**
 * Log in to Naukri. Prefers a pasted session cookie header (fallback when
 * password login is blocked by CAPTCHA/OTP); otherwise uses email/password.
 * Returns { ok: true, via } with an active authenticated session.
 * Throws a structured error on failure.
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    const ok = await withPage(async (page) => {
      const isLoggedIn = await loginWithCookies(page, cookies, cookieOrigin, async (p) => {
        const url = p.url();
        const loggedOut = await p.$('a#login_Layer, a[href*="/nLogin/Login"], a[href*="nlogin/login"], .loginBtn, [data-testid="login-button"]');
        return !(/\/login|\/nlogin|\/nLogin/i.test(url) || loggedOut);
      });
      return isLoggedIn;
    }, 'naukri');
    if (ok) return { ok: true, via: 'cookies' };
    // Cookie present but didn't authenticate → it's expired/invalid. Without
    // credentials there's no point falling through to a doomed password login
    // that would only surface a confusing Puppeteer selector-timeout error.
    if (!email || !password) {
      throw new Error('Naukri session cookie is invalid or expired — use the Login via Browser button in the Job Sites tab to reconnect.');
    }
  }

  return withPage(async (page) => {
    await page.goto(`${BASE}/nlogin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    // Naukri may change field IDs — try multiple selectors.
    const usernameSel = '#usernameField, input[name="email"], input[type="email"], input[name="username"]';
    const passwordSel = '#passwordField, input[name="password"], input[type="password"]';
    await page.waitForSelector(usernameSel, { timeout: 15000 });
    await page.type(usernameSel, email, { delay: 20 });
    await page.type(passwordSel, password, { delay: 20 });

    const submitSel = 'button[type="submit"], .loginBtn, button.sbmt, button[class*="login"]';
    const submitBtn = await page.$(submitSel);
    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        safeClick(page, submitBtn, 'login submit'),
      ]);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    await delay(3000);

    const url = page.url();
    // Check for actual login failure — Naukri shows error messages in specific containers.
    // Don't use broad [class*=error] which matches analytics/form-hint elements.
    const hasLoginError = await page.$('.commonErrorMsg, .errStrip, .nI-gNb-errorMsg, .error-msg, [data-testid="login-error"]');
    const stillOnLogin = /\/login|\/nlogin/i.test(url);
    if (stillOnLogin || hasLoginError) {
      const errText = hasLoginError
        ? await hasLoginError.evaluate(el => el.innerText).catch(() => '')
        : '';
      throw new Error(errText || 'Naukri login failed — check credentials, complete CAPTCHA on the site, or paste a session cookie.');
    }
    return { ok: true, via: 'password' };
  }, 'naukri');
}

/**
 * Search Naukri for jobs matching keywords. Returns a normalized job list.
 * Login session (if stored) is reused from the shared browser context.
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  const q = urlSafeQuery(query);
  const url = `${BASE}/${q}-jobs${location ? '?location=' + encodeURIComponent(location) : ''}`;
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    const jobs = [];
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('.nextPage, [data-qa="pagination-next"], .pagination a:last-child, a[class*=next]');
        if (!next) break;
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          safeClick(page, next, 'next'),
        ]);
        await delay(2000);
      }

      const cards = await page.$$('.srp-jobtuple-wrapper, .cust-job-tuple, .jobTuple, [data-job-id]');
      for (const card of cards) {
        if (jobs.length >= maxJobs) break;
        try {
          const title = await card.$eval('h2 a.title, a.title, .title', (el) => el.textContent.trim()).catch(() => '');
          const urlHref = await card.$eval('h2 a.title, a.title, .title', (el) => el.getAttribute('href') || '').catch(() => '');
          const company = await card.$eval('a.comp-name, .comp-name, [class*="comp-name"]', (el) => el.textContent.trim()).catch(() => '');
          const loc = await card.$eval('span.loc-wrap, .loc-wrap, [class*="loc-wrap"], .location', (el) => el.textContent.trim()).catch(() => '');
          const posted = await card.$eval('span.job-post-day, .job-post-day, [class*="job-post-day"], .type', (el) => el.textContent.trim()).catch(() => '');

          if (title && company) {
            jobs.push({
              title: normalize(title),
              company: normalize(company),
              location: normalize(loc),
              url: urlHref ? (urlHref.startsWith('http') ? urlHref : `${BASE}${urlHref}`) : '',
              postedText: normalize(posted),
              site: 'naukri',
            });
          }
        } catch {
          // skip malformed card
        }
      }
    }
    return jobs;
  }, 'naukri');
}

/** Fetch the full job description for a Naukri job URL. Accepts a URL string or { url }. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    return await page.$eval('.job-desc, [data-qa="jobDescription"], [class*=jobDesc], [class*=job-desc]', (el) => el.textContent.trim()).catch(() => '');
  }, 'naukri');
}

/**
 * Detect the apply form fields for a Naukri job (best-effort, no submit).
 * Returns [{ key, label, type, selector, options }] or [].
 */
async function detectApplyFields({ url }) {
  return detectApplyFormFields({
    url,
    applySelectors: ['.apply-button, button[class*="apply"], a[class*="apply"], [type="button"]:not([data-qa])'],
  });
}

/**
 * Submit an application for a Naukri job.
 * Opens the job page, clicks the primary Apply button, uploads the tailored
 * resume, fills any detected apply-form fields, then confirms. The application
 * is only reported as applied when we can positively confirm it (apply button
 * label switched to "Applied", success text, or the button disappeared).
 * Returns { ok: true, applied } or throws a structured error.
 */
async function submitApplication({ url, credentials, resume, resumeFilename, fields, detected }) {
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    const applyBtn = await page.$('.apply-button, button[class*="apply"], a[class*="apply"]');
    if (!applyBtn) {
      const hasLogin = await page.$('a[href*="/login"], input[name="email"]');
      if (hasLogin) throw new Error('Login required — save credentials or paste a session cookie for Naukri.');
      throw new Error('No apply button found on this Naukri job.');
    }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        safeClick(page, applyBtn, 'apply'),
      ]);
    await delay(3000);

    // Upload the tailored resume if the apply flow offers a file input.
    if (resume) {
      await uploadResumeFile(page, resume, resumeFilename).catch(() => {});
      await delay(500);
    }

    // Auto-fill the detected apply-form fields (best-effort; skips missing ones).
    if (fields && detected?.length) {
      await fillFields(page, fields, detected).catch(() => {});
      await delay(500);
    }

    // Confirm: prefer the visible submit button, fall back to text matching.
    const confirmBtn = await page.$('button[class*="submit"], button[class*="apply"], [type="submit"]');
    if (confirmBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        safeClick(page, confirmBtn, 'confirm'),
      ]);
      await delay(1800);
    } else {
      await clickButtonByText(page, ['submit application', 'submit', 'apply']).catch(() => {});
      await delay(1500);
    }

    // Naukri keeps the apply button in the DOM but swaps its label to "Applied"
    // — check the button text/state, not just its presence.
    const state = await readApplyState(page, '.apply-button, button[class*="apply"], a[class*="apply"]');
    return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
  }, 'naukri');
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields };
