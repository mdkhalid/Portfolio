const { withPage, safeText, delay, loginWithCookies } = require('./browser');
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
        const loggedOut = await p.$('.loginBtn, [data-testid="login-button"], a[href*="nlogin/login"]');
        return !(url.includes('/login') || loggedOut);
      });
      return isLoggedIn;
    });
    if (ok) return { ok: true, via: 'cookies' };
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
        submitBtn.click(),
      ]);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    await delay(3000);

    const url = page.url();
    // Check for actual login failure — Naukri shows error messages in specific containers.
    // Don't use broad [class*=error] which matches analytics/form-hint elements.
    const hasLoginError = await page.$('.errStrip, .nI-gNb-errorMsg, .error-msg, [data-testid="login-error"]');
    const stillOnLogin = url.includes('/login') || url.includes('/nlogin');
    if (stillOnLogin || hasLoginError) {
      const errText = hasLoginError
        ? await hasLoginError.evaluate(el => el.innerText).catch(() => '')
        : '';
      throw new Error(errText || 'Naukri login failed — check credentials, complete CAPTCHA on the site, or paste a session cookie.');
    }
    return { ok: true, via: 'password' };
  });
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
          next.click(),
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
  });
}

/** Fetch the full job description for a Naukri job URL. Accepts a URL string or { url }. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    return await page.$eval('.job-desc, [data-qa="jobDescription"], [class*=jobDesc], [class*=job-desc]', (el) => el.textContent.trim()).catch(() => '');
  });
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
 * Opens the job page, clicks the primary Apply button, fills any detected
 * apply-form fields from the resolved `fields` map, then confirms.
 * Returns { ok: true } on success or throws a structured error so the worker
 * can mark the application as failed (not_applied) with a real reason.
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
      applyBtn.click(),
    ]);
    await delay(3000);

    // Auto-fill the detected apply-form fields (best-effort; skips missing ones).
    if (fields && detected?.length) {
      await fillFields(page, fields, detected).catch(() => {});
      await delay(500);
    }

    const confirmBtn = await page.$('button[class*="submit"], button[class*="apply"], [type="submit"]');
    if (confirmBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        confirmBtn.click(),
      ]);
      await delay(1500);
    }

    // Check if the Apply button is still visible — if so, the application
    // was NOT actually submitted (modal closed, form rejected, etc.).
    const stillHasApply = await page.$('.apply-button, button[class*="apply"]').catch(() => null);
    if (stillHasApply) {
      return { ok: true, applied: false, via: 'submitApplication' };
    }

    // Look for explicit success text instead of broad class selectors.
    const hasSuccessText = await page.evaluate(() => {
      const body = (document.body && document.body.innerText) || '';
      return /you have applied|application submitted|successfully applied|applied successfully/i.test(body.slice(0, 5000));
    });
    return { ok: true, applied: hasSuccessText, via: 'submitApplication' };
  });
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields };
