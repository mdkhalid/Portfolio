const { withPage, safeText, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick, ensureLoggedIn } = require('./browser');
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
 * Naukri auth check — the SAME strict rule is used for login verification and
 * for the pre-submit check. A bare `a[href*="/login"]` link on the page is NOT
 * proof of a logged-out session (Naukri sprinkles login links in widgets even
 * when logged in), so this only treats the page as logged out when the actual
 * login layer/URL is present.
 */
async function isNaukriAuthenticated(page) {
  const url = page.url();
  // Only the header login button (#login_Layer) counts as a logged-out signal —
  // login links in promo widgets/sidebars appear even when logged in.
  const loggedOut = await page.$('a#login_Layer, .loginBtn');
  return !(/\/login|\/nlogin|\/nLogin/i.test(url) || loggedOut);
}

/**
 * Throw the manual-apply handoff error when the apply flow left naukri.com —
 * either by navigating the SAME tab to an employer careers page or by opening
 * the employer site in a NEW tab. Without this, the post-click state read
 * fails on the foreign page, confirmApplied() mistakes the navigation for a
 * confirmation redirect, and the job is falsely marked "Applied".
 */
async function assertStillOnNaukri(page) {
  if (!/naukri\.com/i.test(page.url() || '')) {
    throw new Error('Naukri redirected to an employer site — complete the application manually.');
  }
  try {
    const pages = page.browser().pages ? page.browser().pages() : [];
    for (const p of pages) {
      if (p === page || (typeof p.isClosed === 'function' && p.isClosed())) continue;
      const u = p.url();
      if (/^https?:\/\//i.test(u) && !/naukri\.com/i.test(u)) {
        throw new Error('Naukri redirected to an employer site (opened in a new tab) — complete the application manually.');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('employer site')) throw err;
    // best-effort only — page enumeration issues must not break the flow
  }
}

/** Fill and submit the Naukri email/password login form on `page`. Throws on failure. */
async function naukriPasswordLogin(page, email, password) {
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
      const isLoggedIn = await loginWithCookies(page, cookies, cookieOrigin, isNaukriAuthenticated);
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
    await naukriPasswordLogin(page, email, password);
    return { ok: true, via: 'password' };
  }, 'naukri');
}

/**
 * Search Naukri for jobs matching keywords. Returns a normalized job list.
 * Login session (if stored) is reused from the shared browser context.
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  const q = urlSafeQuery(query);
  // Naukri has no ?location= query param — the location filter only works in
  // the path form /<query>-jobs-in-<location>.
  const loc = location ? urlSafeQuery(location) : '';
  const url = `${BASE}/${q}-jobs${loc ? '-in-' + loc : ''}`;
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
    site: 'naukri',
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
async function submitApplication({ url, credentials, cookie, cookieOrigin, resume, resumeFilename, fields, detected }) {
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    // The worker logs in first, but a session can lapse between login and
    // submit (or the stored cookie can expire). Verify with the same strict
    // check login() uses — a bare "/login" link is NOT proof of a logged-out
    // page — and restore the session right here instead of failing the apply.
    const auth = await ensureLoggedIn(page, {
      checkLoggedIn: isNaukriAuthenticated,
      cookie,
      cookieOrigin,
      passwordLogin: () => naukriPasswordLogin(page, credentials?.email || '', credentials?.password || ''),
    });
    if (!auth) {
      throw new Error('Login required — save credentials or paste a session cookie for Naukri, then retry.');
    }
    if (auth !== 'session') {
      // A login navigation moved us off the job page — reopen it fresh.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await delay(1500);
    }

const applyBtn = await page.$('.apply-button, button[class*="apply"], a[class*="apply"], button[data-test="applyButton"]');
    if (!applyBtn) {
      // Fallback: try clicking by text "Apply" — Naukri sometimes renders the button with just "Apply" text
      const clicked = await clickButtonByText(page, ['apply']);
      if (clicked) {
        await delay(3000);
        // The click may have handed off to the employer's site — detect it
        // BEFORE reading state, or the failed read gets misread as success.
        await assertStillOnNaukri(page);
        const state = await readApplyState(page, '.apply-button, button[class*="apply"], a[class*="apply"]');
        return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
      }
      const state = await readApplyState(page, '.apply-button, button[class*="apply"], a[class*="apply"]');
      if (state?.successText) return { ok: true, applied: true, via: 'submitApplication' };
      throw new Error('No apply button found on this Naukri job (may redirect to employer site or require manual apply).');
    }

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        safeClick(page, applyBtn, 'apply'),
      ]);
    await delay(3000);

    // The apply click frequently navigates to the employer's own careers page
    // (Naukri hands off external applications). Detect it here, before the
    // resume upload / field fill run against the WRONG page.
    await assertStillOnNaukri(page);

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

    // Confirm: scope to the apply modal/dialog/form so we never re-click the
    // main apply button or an unrelated submit (e.g. the search form).
    const confirmBtn = await page.$([
      '[role="dialog"] button[class*="submit"]',
      '[role="dialog"] [type="submit"]',
      '[class*="modal"] button[class*="submit"]',
      '[class*="modal"] [type="submit"]',
      'form[class*="apply"] [type="submit"]',
      '[class*="apply-modal"] button',
    ].join(', '));
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
    // — check the button text/state, not just its presence. But FIRST make sure
    // the confirm click didn't dump us on the employer's site: the read below
    // would fail there and confirmApplied() would misreport it as applied.
    await assertStillOnNaukri(page);
    const state = await readApplyState(page, '.apply-button, button[class*="apply"], a[class*="apply"]');
    return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
  }, 'naukri');
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields, isAuthenticated: isNaukriAuthenticated };
