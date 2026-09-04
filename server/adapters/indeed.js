const { withPage, safeText, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick, ensureLoggedIn } = require('./browser');
const { detectApplyFormFields, fillFields } = require('../services/applyFields');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.indeed.com';

// Positive logged-in signals: account/notifications menus only render for
// authenticated users. Cover current and recent header markups.
const LOGGED_IN_SELS = [
  '[data-testid="account-menu"]',
  '[data-testid="notifications-menu"]',
  '[data-gnav-element-name="Account"]',
  '[data-gnav-element-name="Notifications"]',
  'a[href*="/account/settings"]',
  'a[href*="/myjobs"]',
  'button[aria-label*="account" i]',
  'button[aria-label*="notification" i]',
];

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** True when the page is an Indeed bot-check / rate-limit interstitial, not the site. */
async function isIndeedChallengePage(page) {
  try {
    const text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 3000));
    return /verify you are (a )?human|checking your browser|just a moment|attention required|too many requests|rate limit|unusual traffic|px-captcha|recaptcha|cf-challenge|enable javascript and cookies/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Detailed Indeed auth probe — same logic as the boolean check below, but
 * returns WHY it concluded what it did so a failed cookie check is
 * diagnosable from logs instead of a bare "expired" message.
 * Returns { ok, url, challenge, matchedSignal, signInFound, reason }.
 */
async function probeIndeedAuth(page) {
  const url = page.url();
  if (url.includes('/login') || url.includes('/account/login')) {
    return { ok: false, url, challenge: false, matchedSignal: '', signInFound: true, reason: 'login-url' };
  }
  if (await isIndeedChallengePage(page)) {
    return { ok: false, url, challenge: true, matchedSignal: '', signInFound: false, reason: 'challenge' };
  }
  const probe = await page.evaluate((sels) => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const matchedSignal = sels.find((sel) =>
      Array.from(document.querySelectorAll(sel)).some(isVisible)
    ) || '';
    if (matchedSignal) return { matchedSignal, signInFound: false };
    // Logged-out signals: a visible sign-in CTA anywhere in header/nav/main.
    const signInFound = Array.from(document.querySelectorAll('a, button')).some((el) => {
      if (!isVisible(el)) return false;
      const href = el.getAttribute('href') || '';
      const text = (el.textContent || '').trim().toLowerCase();
      return href.includes('/account/login') || /^(sign in|log in)$/.test(text);
    });
    return { matchedSignal: '', signInFound };
  }, LOGGED_IN_SELS).catch(() => null);
  if (!probe) {
    return { ok: false, url, challenge: false, matchedSignal: '', signInFound: false, reason: 'evaluate-failed' };
  }
  if (probe.matchedSignal) {
    return { ok: true, url, challenge: false, matchedSignal: probe.matchedSignal, signInFound: false, reason: 'positive-signal' };
  }
  return {
    ok: !probe.signInFound, url, challenge: false, matchedSignal: '',
    signInFound: probe.signInFound, reason: probe.signInFound ? 'sign-in-cta' : 'no-signal',
  };
}

/**
 * Indeed auth check — shared between login() and the pre-submit check.
 * Absence of a login link alone is NOT proof of a session: the nav renders
 * late (only ~2s after domcontentloaded) and Indeed's logged-out CTA markup
 * changes often, so both directions produced false readings. Require a
 * POSITIVE logged-in signal (account menu / notifications / profile link)
 * and treat a login URL or visible sign-in CTA as logged out.
 * A bot-check / rate-limit interstitial is neither — return false so callers
 * can classify it as transient instead of mistaking it for a live session.
 */
async function isIndeedAuthenticated(page) {
  return (await probeIndeedAuth(page)).ok;
}

/** Best-effort screenshot of a failed login check for post-mortem diagnosis. */
async function captureDebugShot(page, tag = 'indeed') {
  try {
    const dir = path.join(__dirname, '..', 'data', 'login-debug');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${tag}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return '';
  }
}

/** Fill and submit the Indeed email/password login form on `page`. Throws on failure. */
async function indeedPasswordLogin(page, email, password) {
  await page.goto(`${BASE}/account/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
}

/**
 * Log in to Indeed. Prefers a pasted session cookie header (fallback when
 * Google/Apple SSO or CAPTCHA blocks programmatic login); otherwise attempts
 * the email/password form and returns a structured error if blocked.
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    // Three-way verdict: the cookie check always runs against the same home
    // URL, so a failure on one job while others succeed is a TRANSIENT
    // bot-check / rate-limit interstitial — not a dead cookie — and must not
    // be misreported as "session expired" (which marks the job login_failed).
    const verdict = await withPage(async (page) => {
      if (await loginWithCookies(page, cookies, cookieOrigin, isIndeedAuthenticated)) return { status: 'ok' };
      const probe = await probeIndeedAuth(page);
      if (probe.challenge) return { status: 'challenge' };
      // Log the full diagnosis + keep a screenshot: "cookie expired" on one
      // job while others succeed means the page state — not the cookie — is
      // at fault, and the reason field says which.
      const shot = await captureDebugShot(page, 'indeed-login');
      console.error('[indeed] cookie check failed:', JSON.stringify({ ...probe, shot }));
      return { status: 'logged_out' };
    }, 'indeed');
    if (verdict.status === 'ok') return { ok: true, via: 'cookies' };
    if (verdict.status === 'challenge') {
      throw new Error('Indeed is bot-checking automated traffic right now (transient) — retry this job later. Your saved Indeed connection is still valid.');
    }
    // Cookie present but didn't authenticate → it's expired/invalid. Without
    // credentials there's no point falling through to a doomed password login
    // that would only surface a confusing Puppeteer selector-timeout error.
    if (!email || !password) {
      throw new Error('Indeed session cookie is invalid or expired — use the Login via Browser button in the Job Sites tab to reconnect.');
    }
  }

  return withPage(async (page) => {
    await indeedPasswordLogin(page, email, password);
    return { ok: true, via: 'password' };
  }, 'indeed');
}

/**
 * Search Indeed for jobs matching keywords. Returns a normalized job list.
 * Public search works without login for the listing (details/apply may need it).
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  // Join with spaces, not '+': URLSearchParams encodes '+' as %2B, which makes
  // Indeed search for a literal "word%2Bword" string and return no results.
  const q = normalize(query).split(/\s+/).slice(0, 4).join(' ');
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
    site: 'indeed',
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
async function submitApplication({ url, credentials, cookie, cookieOrigin, resume, resumeFilename, fields, detected }) {
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    // Same self-healing login as Naukri: verify the session with the strict
    // check login() uses and restore it here if it lapsed before applying.
    const auth = await ensureLoggedIn(page, {
      checkLoggedIn: isIndeedAuthenticated,
      cookie,
      cookieOrigin,
      passwordLogin: () => indeedPasswordLogin(page, credentials?.email || '', credentials?.password || ''),
    });
    if (!auth) {
      // Same transient-vs-dead distinction as login(): a challenge page here
      // means throttling, not an expired cookie.
      if (await isIndeedChallengePage(page)) {
        throw new Error('Indeed is bot-checking automated traffic right now (transient) — retry this job later. Your saved Indeed connection is still valid.');
      }
      throw new Error('Login required — save credentials or paste a session cookie for Indeed, then retry.');
    }
    if (auth !== 'session') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await delay(1500);
    }

    const applyBtn = await page.$('button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"], a[class*="apply"], button[data-testid="karmaApplyButton"], .apply-button, .jobsApplyButton');
    if (!applyBtn) {
      // Fallback: try clicking by text (Indeed sometimes renders "Apply" as a link or button with specific text)
      const clicked = await clickButtonByText(page, ['apply now', 'apply', 'submit application']);
      if (clicked) {
        await delay(3000);
        const state = await readApplyState(page, 'button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"]');
        return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
      }
      const state = await readApplyState(page, 'button[data-testid="applyButton"], #indeedApplyButton, button[class*="apply"]');
      if (state?.successText) return { ok: true, applied: true, via: 'submitApplication' };
      // A missing apply button is often a bot-check interstitial (nothing on
      // the page renders). Throw the TRANSIENT message so the retry path can
      // pick it up later instead of wrongly routing it to Manual Apply.
      if (await isIndeedChallengePage(page)) {
        throw new Error('Indeed is bot-checking automated traffic right now (transient) — retry this job later. Your saved Indeed connection is still valid.');
      }
      throw new Error('No apply button found on this Indeed job (may redirect to employer site or require interaction).');
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
    // Employer sites frequently open the apply page in a NEW TAB/WINDOW — the
    // original page URL stays on indeed.com, so also scan the browser for any
    // non-Indeed page opened by this click.
    try {
      const pages = page.browser().pages ? page.browser().pages() : [];
      for (const p of pages) {
        if (p === page || p.isClosed?.()) continue;
        const u = p.url();
        if (/^https?:\/\//i.test(u) && !u.includes('indeed.com')) {
          throw new Error('Indeed redirected to an employer site (opened in a new tab) — complete the application manually.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('employer site')) throw err;
      // best-effort only — page enumeration issues must not break the flow
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

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields, isAuthenticated: isIndeedAuthenticated };
