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
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('[data-testid="pagination-page-next"] a, a[aria-label="Next Page"], a[aria-label="Next"]');
        if (!next) break;
        await next.click();
        await delay(2500);
      }
      const items = await page.$$('.result, .job_seen_beacon, [data-testid="job-listing"], .slider_item, td.resultContent');
      for (const item of items) {
        if (jobs.length >= maxJobs) break;
        try {
          const title = await item.$eval('h2 a, .jobTitle a, [data-jk], a[id^="job_"], a[class*="jスカ"]', (el) => el.textContent.trim()).catch(() => '');
          const urlHref = await item.$eval('h2 a, .jobTitle a, [data-jk], a[id^="job_"]', (el) => el.getAttribute('href') || '').catch(() => '');
          const company = await safeText(item, '[data-testid="company-name"], .companyName, .company, [class*="company"]');
          const locationEl = await safeText(item, '[data-testid="text-location"], .location, .companyLocation, [class*="location"]');
          const posted = await safeText(item, '[data-testid="myJobsStateDate"], .date, [class*="date"]');
          if (title) {
            jobs.push({
              title: normalize(title),
              company: normalize(company) || 'Confidential',
              location: normalize(locationEl),
              url: urlHref ? (urlHref.startsWith('http') ? urlHref : `${BASE}${urlHref}`) : '',
              postedText: normalize(posted),
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

/** Fetch the full job description for an Indeed job URL. */
async function fetchJobDescription(url) {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);
    return await safeText(page, '#jobDescriptionText, [data-testid="jobDescriptionText"]');
  });
}

module.exports = { login, searchJobs, fetchJobDescription };
