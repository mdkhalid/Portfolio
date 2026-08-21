const { withPage, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick, gotoWithBackoff, blockError, ensureLoggedIn } = require('./browser');
const { detectApplyFormFields, fillFields } = require('../services/applyFields');

const BASE = 'https://www.foundit.in';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * foundit auth check — shared between login() and the pre-submit check.
 * foundit fronts search/browse with a bot wall ("Access Denied"), so a block
 * page is explicitly NOT a logged-in page. A header login/signup link or a
 * /login URL counts as logged out.
 */
async function isFounditAuthenticated(page) {
  const url = page.url();
  if (/\/login|\/signin|\/register/i.test(url)) return false;
  const body = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 3000)).catch(() => '');
  if (/access denied|too many requests|checking your browser|verify you are human|just a moment/i.test(body)) return false;
  const loggedOut = await page.$('a[href*="/login"], a[href*="/register"], [class*="loginBtn"], header a[href*="signin"]').catch(() => null);
  return !loggedOut;
}

/**
 * Log in to foundit. Cookies are OPTIONAL — plain email/password is a
 * first-class path. Order: pasted session cookie header (if provided) →
 * persistent browser profile (if previously earned) → email/password modal.
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    const ok = await withPage(async (page) =>
      loginWithCookies(page, cookies, cookieOrigin, isFounditAuthenticated), 'foundit');
    if (ok) return { ok: true, via: 'cookies' };
  }

  // No cookie needed: with credentials on file, go straight to the password
  // form. The profile check only runs when there are no credentials to try.
  if (email && password) {
    return withPage(async (page) => {
      await founditPasswordLogin(page, email, password);
      return { ok: true, via: 'password' };
    }, 'foundit');
  }

  // The persistent profile may already hold the session — one navigation to
  // confirm, no login-form traffic (keeps the bot wall quiet).
  const profileOk = await withPage(async (page) => {
    const resp = await gotoWithBackoff(page, BASE, { timeout: 40000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('foundit: ' + blocked);
    await delay(2500);
    return isFounditAuthenticated(page);
  }, 'foundit');
  if (profileOk) return { ok: true, via: 'profile' };

  throw new Error('foundit needs either saved credentials (email/password) or a one-time "Login via Browser" session.');
}

/** Fill and submit the foundit email/password login modal on `page`. */
async function founditPasswordLogin(page, email, password) {
  const resp = await gotoWithBackoff(page, `${BASE}/login`, { timeout: 40000 });
  const blocked = blockError(resp);
  if (blocked) throw new Error('foundit: ' + blocked);
  await delay(3000);

  // The login form lives in a modal opened by the header "Login" button.
  let emailSel = 'input[type="email"], input[name="email"], input[placeholder*="mail" i], input[id*="email" i]';
  if (!(await page.$(emailSel))) {
    const loginBtn = await page.$('button[class*="login" i], a[class*="login" i], header button');
    if (loginBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
        safeClick(page, loginBtn, 'login open'),
      ]);
      await delay(2000);
    }
  }

  const emailInput = await page.$(emailSel);
  const passInput = await page.$('input[type="password"]');
  if (!emailInput || !passInput) {
    throw new Error('foundit login requires CAPTCHA/bot verification. Use the "Login via Browser" button to connect.');
  }

  await emailInput.type(email, { delay: 20 });
  await passInput.type(password, { delay: 20 });

  const submitBtn = await page.$('button[type="submit"], button[class*="login" i]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    submitBtn ? safeClick(page, submitBtn, 'login submit') : page.keyboard.press('Enter'),
  ]);
  await delay(3000);

  if (!(await isFounditAuthenticated(page))) {
    throw new Error('foundit login failed — check credentials or use the "Login via Browser" button to solve CAPTCHA.');
  }
}

/**
 * Search foundit for jobs matching keywords.
 * URL format: /search/<keywords>-jobs[-in-<location>]. The bot wall blocks
 * fresh environments — a connected session (cookie/profile) is required, and
 * block pages surface as clear errors instead of empty results.
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 } = {}) {
  const q = normalize(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  const locSlug = location
    ? '-in-' + normalize(location).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')
    : '';
  const url = `${BASE}/search/${q}-jobs${locSlug}`;

  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, url, { timeout: 45000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('foundit: ' + blocked + ' — save credentials or connect once via "Login via Browser".');
    await delay(4000);

    const jobs = [];
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('[class*="pagination" i] a:last-child, a[aria-label="Next"], a[class*="next" i]');
        if (!next) break;
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          safeClick(page, next, 'next'),
        ]);
        await delay(3000);
      }

      // Best-effort card scan: foundit renders job cards as links to job
      // detail pages; selectors have several fallbacks because the SPA class
      // names change between releases.
      const cards = await page.$$eval('a[href*="/job/"], a[href*="joblisting"], a[href*="/middleware/"]', (anchors) =>
        anchors.map((a) => ({
          href: a.getAttribute('href') || '',
          text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          titleCls: (a.querySelector('[class*="title" i], h2, h3') || {}).textContent || '',
          companyCls: (a.querySelector('[class*="company" i], [class*="compName" i]') || {}).textContent || '',
          locCls: (a.querySelector('[class*="location" i], [class*="loc" i]') || {}).textContent || '',
          postedCls: (a.querySelector('[class*="posted" i], [class*="date" i], time') || {}).textContent || '',
        }))
      ).catch(() => []);

      for (const card of cards) {
        if (jobs.length >= maxJobs) break;
        if (!card.href || jobs.some((j) => j.url === card.href)) continue;
        // Fall back to positional parsing of the card text when the styled
        // spans are missing: first line ~ title, a line with commas ~ location.
        const lines = card.text.split(' ').length > 4 ? card.text : '';
        const title = normalize(card.titleCls) || (lines ? lines.slice(0, 120) : '');
        if (!title) continue;
        jobs.push({
          title,
          company: normalize(card.companyCls) || 'Confidential',
          location: normalize(card.locCls),
          url: card.href.startsWith('http') ? card.href : `${BASE}${card.href}`,
          postedText: normalize(card.postedCls),
          site: 'foundit',
        });
      }
    }
    return jobs;
  }, 'foundit');
}

/** Fetch the full job description for a foundit job URL. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return '';
  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, url, { timeout: 40000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('foundit: ' + blocked);
    await delay(2500);
    return await page.evaluate(() => {
      const descEl = document.querySelector(
        '[class*="jobDescription" i], [class*="job-desc" i], [class*="description" i], [itemprop="description"], article'
      );
      return descEl ? descEl.innerText.trim() : '';
    });
  }, 'foundit');
}

/**
 * Detect the apply form fields for a foundit job (best-effort, no submit).
 */
async function detectApplyFields({ url }) {
  return detectApplyFormFields({
    url,
    applySelectors: ['button[class*="apply" i], a[class*="apply" i], button[data-test*="apply" i]'],
  });
}

/**
 * Submit an application for a foundit job.
 * Opens the job page, verifies/restores the session, clicks Apply, uploads
 * the tailored resume, fills detected fields, then confirms. Only a
 * positively confirmed state reports applied (see confirmApplied).
 */
async function submitApplication({ url, credentials, cookie, cookieOrigin, resume, resumeFilename, fields, detected }) {
  if (!url) throw new Error('No job URL provided for foundit application');
  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, url, { timeout: 45000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('foundit: ' + blocked);
    await delay(2500);

    // Session can lapse between login and submit — restore in place instead
    // of failing the application on a stale session.
    const auth = await ensureLoggedIn(page, {
      checkLoggedIn: isFounditAuthenticated,
      cookie,
      cookieOrigin,
      passwordLogin: () => founditPasswordLogin(page, credentials?.email || '', credentials?.password || ''),
    });
    if (!auth) {
      throw new Error('Login required — save credentials or paste a session cookie for foundit, then retry.');
    }
    if (auth !== 'session') {
      await gotoWithBackoff(page, url, { timeout: 45000 }).catch(() => {});
      await delay(2000);
    }

    const applyBtn = await page.$('button[class*="apply" i], a[class*="apply" i], button[data-test*="apply" i]');
    if (!applyBtn) {
      const clicked = await clickButtonByText(page, ['apply now', 'apply']);
      if (clicked) {
        await delay(3000);
        const state = await readApplyState(page, 'button[class*="apply" i], a[class*="apply" i]');
        return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
      }
      const state = await readApplyState(page, 'button[class*="apply" i], a[class*="apply" i]');
      if (state?.successText) return { ok: true, applied: true, via: 'submitApplication' };
      throw new Error('No apply button found on this foundit job (may redirect to employer site or require manual apply).');
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

    // Auto-fill detected apply-form fields (best-effort; skips missing ones).
    if (fields && detected?.length) {
      await fillFields(page, fields, detected).catch(() => {});
      await delay(500);
    }

    // Confirm: prefer the visible submit button, fall back to text matching.
    const confirmBtn = await page.$('button[class*="submit" i], [type="submit"]');
    if (confirmBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        safeClick(page, confirmBtn, 'confirm'),
      ]);
      await delay(1800);
    } else {
      await clickButtonByText(page, ['submit application', 'submit', 'apply']).catch(() => {});
      await delay(1500);
    }

    const state = await readApplyState(page, 'button[class*="apply" i], a[class*="apply" i]');
    return { ok: true, ...confirmApplied(state), via: 'submitApplication' };
  }, 'foundit');
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication, detectApplyFields, isAuthenticated: isFounditAuthenticated };
