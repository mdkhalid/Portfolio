const { withPage, safeText, delay } = require('./browser');

const BASE = 'https://www.indeed.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Log in to Indeed. Indeed relies heavily on Google/Apple SSO and CAPTCHA,
 * so automation is best-effort. We navigate to the login page; if programmatic
 * login is blocked we return a structured error rather than failing silently.
 */
async function login({ email, password }) {
  return withPage(async (page) => {
    await page.goto(`${BASE}/account/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Attempt the email/password form if present.
    const hasForm = !!(await page.$('input[name="email"], input[name="login-email"], input[type="email"]'));
    if (!hasForm) {
      throw new Error('Indeed login uses Google/Apple SSO or CAPTCHA and cannot be automated. Log in manually in the browser once, then retry.');
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
      throw new Error('Indeed login failed — SSO/CAPTCHA required. Log in manually, then retry.');
    }
    return { ok: true };
  });
}

/**
 * Search Indeed for jobs matching keywords. Returns a normalized job list.
 * Public search works without login for the listing (details/apply may need it).
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  const q = normalize(query).split(/\s+/).join('+');
  const params = new URLSearchParams({ q });
  if (location) params.set('l', location);
  const url = `${BASE}/jobs?${params.toString()}`;
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    const jobs = [];
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('[data-testid="pagination-page-next"] a, a[aria-label="Next Page"]');
        if (!next) break;
        await next.click();
        await delay(2000);
      }
      const items = await page.$$('.result, .job_seen_beacon, [data-testid="job-listing"]');
      for (const item of items) {
        if (jobs.length >= maxJobs) break;
        try {
          const title = await item.$eval('h2 a, .jobTitle a, [data-jk]', (el) => el.textContent.trim());
          const urlHref = await item.$eval('h2 a, .jobTitle a, [data-jk]', (el) => el.getAttribute('href') || '');
          const company = await safeText(item, '[data-testid="company-name"], .companyName, .company');
          const locationEl = await safeText(item, '[data-testid="text-location"], .location, .companyLocation');
          const posted = await safeText(item, '[data-testid="myJobsStateDate"], .date');
          jobs.push({
            title: normalize(title),
            company: normalize(company),
            location: normalize(locationEl),
            url: urlHref.startsWith('http') ? urlHref : `${BASE}${urlHref}`,
            postedText: normalize(posted),
            site: 'indeed',
          });
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
