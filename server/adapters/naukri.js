const { withPage, safeText, delay } = require('./browser');

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
 * Log in to Naukri with email/password. Returns the page with an active
 * authenticated session (cookies kept in the shared browser context).
 * Throws a structured error on failure.
 */
async function login({ email, password }) {
  return withPage(async (page) => {
    await page.goto(`${BASE}/nlogin/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    await page.waitForSelector('#usernameField', { timeout: 10000 });
    await page.type('#usernameField', email, { delay: 20 });
    await page.type('#passwordField', password, { delay: 20 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]').catch(async () => {
        const btn = await page.$('.loginBtn, [type="submit"]');
        if (btn) await btn.click();
      }),
    ]);
    await delay(2000);

    const url = page.url();
    const hasError = await page.$('.error, .alert, [class*=error], [class*=Error]');
    if (url.includes('/login') || hasError) {
      const errText = await page.$eval('.error, .alert, [class*=error], [class*=Error]', el => el.innerText).catch(() => '');
      throw new Error(errText || 'Naukri login failed — check credentials or complete CAPTCHA on the site.');
    }
    return { ok: true };
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

/** Fetch the full job description for a Naukri job URL. */
async function fetchJobDescription(url) {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    return await page.$eval('.job-desc, [data-qa="jobDescription"], [class*=jobDesc], [class*=job-desc]', (el) => el.textContent.trim()).catch(() => '');
  });
}

module.exports = { login, searchJobs, fetchJobDescription };
