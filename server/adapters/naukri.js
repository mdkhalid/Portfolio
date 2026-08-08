const { withPage, safeText, delay } = require('./browser');

const BASE = 'https://www.naukri.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Log in to Naukri with email/password. Returns the page with an active
 * authenticated session (cookies kept in the shared browser context).
 * Throws a structured error on failure.
 */
async function login({ email, password }) {
  return withPage(async (page) => {
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.type('#usernameField', email, { delay: 20 });
    await page.type('#passwordField', password, { delay: 20 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]').catch(() => page.click('.login-btn')),
    ]);
    // If we landed on a page with the user's name or profile link, login worked.
    const url = page.url();
    const loggedIn = !url.includes('/login') || !!(await page.$('.ni-gnb-icn-name, .user-name, [data-qa="userName"]'));
    if (!loggedIn) {
      throw new Error('Naukri login failed — check credentials or complete CAPTCHA on the site.');
    }
    return { ok: true };
  });
}

/**
 * Search Naukri for jobs matching keywords. Returns a normalized job list.
 * Login session (if stored) is reused from the shared browser context.
 */
async function searchJobs({ query, location = '', pageCount = 1, maxJobs = 50 }) {
  const q = normalize(query).split(/\s+/).join('-');
  const url = `${BASE}/${q}-jobs${location ? '?location=' + encodeURIComponent(location) : ''}`;
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    const jobs = [];
    for (let p = 0; p < pageCount && jobs.length < maxJobs; p++) {
      if (p > 0) {
        const next = await page.$('.nextPage, [data-qa="pagination-next"]');
        if (!next) break;
        await next.click();
        await delay(2000);
      }
      const items = await page.$$('.jobTuple, .job-list .job');
      for (const item of items) {
        if (jobs.length >= maxJobs) break;
        try {
          const title = await item.$eval('.title a, .job-title', (el) => el.textContent.trim());
          const urlHref = await item.$eval('.title a, .job-title', (el) => el.getAttribute('href') || '');
          const company = await safeText(item, '.subTitle, .company-name');
          const locationEl = await item.$eval('.location, [data-qa="jobSearchClientLocation"]', (el) => el.textContent.trim());
          const posted = await safeText(item, '.job-posted, [data-qa="job-posted-date"]');
          jobs.push({
            title: normalize(title),
            company: normalize(company),
            location: normalize(locationEl),
            url: urlHref.startsWith('http') ? urlHref : `${BASE}${urlHref}`,
            postedText: normalize(posted),
            site: 'naukri',
          });
        } catch {
          // skip malformed card
        }
      }
    }
    return jobs;
  });
}

/** Fetch the full job description for a Naukri job URL. */
async function fetchJobDescription(url) {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);
    return await safeText(page, '.job-desc, [data-qa="jobDescription"]');
  });
}

module.exports = { login, searchJobs, fetchJobDescription };
