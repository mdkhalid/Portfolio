const { withPage, safeText, delay, loginWithCookies } = require('./browser');

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
    });
    if (ok) return { ok: true, via: 'cookies' };
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
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"], button[data-testid="login-button"]').catch(() => {}),
    ]);
    if (page.url().includes('login')) {
      throw new Error('Indeed login failed — SSO/CAPTCHA required. Log in manually, then paste your session cookie.');
    }
    return { ok: true, via: 'password' };
  });
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
        await next.click();
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
  });
}

/** Fetch the full job description for an Indeed job URL. Accepts a URL string or { url }. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);
    return await safeText(page, '#jobDescriptionText, [data-testid="jobDescriptionText"]');
  });
}

/**
 * Submit an application for an Indeed job.
 * Best-effort: opens the job page and clicks the primary Apply button.
 * Indeed apply often routes through employer sites / SSO; when that happens we
 * throw a structured error so the worker marks the application not_applied
 * instead of silently pretending success.
 */
async function submitApplication({ url, credentials, resume, resumeFilename }) {
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
      applyBtn.click(),
    ]);
    await delay(3500);

    // External employer application — can't be automated beyond the click.
    const urlNow = page.url();
    if (!urlNow.includes('indeed.com')) {
      throw new Error('Indeed redirected to an employer site — complete the application manually.');
    }

    const confirmBtn = await page.$('button[data-testid="form-submit"], button[type="submit"], button[class*="submit"]');
    if (confirmBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        confirmBtn.click(),
      ]);
      await delay(1500);
    }

    const applied = await page.$('[class*="success"], [data-testid="post-apply"]').catch(() => null);
    return { ok: true, applied: Boolean(applied), via: 'submitApplication' };
  });
}

module.exports = { login, searchJobs, fetchJobDescription, submitApplication };
