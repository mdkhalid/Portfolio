const { withPage, delay, loginWithCookies, safeClick } = require('./browser');

const BASE = 'https://www.workatastartup.com';
const ACCOUNT = 'https://account.ycombinator.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Log in to Work at a Startup (YC SSO). The password flow lives on
 * account.ycombinator.com and is a two-step form: username/email -> Continue
 * -> password -> Log in. Prefers a pasted session cookie when provided.
 * Returns { ok: true, via }. Throws a structured error on failure.
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    const ok = await withPage(async (page) => {
      const isLoggedIn = await loginWithCookies(page, cookies, cookieOrigin, async (p) => {
        const url = p.url();
        // After login, YC redirects to workatastartup.com. If we're still on
        // account.ycombinator.com or a login/auth page, the cookie is stale.
        // Check for specific login-form indicators (not just any "Log In" link
        // which can appear in headers/footers of the authenticated page).
        const onAuthPage = url.includes('account.ycombinator.com') || /\/login|signin|auth/i.test(url);
        const hasPasswordField = !!(await p.$('input[type="password"]'));
        return !(onAuthPage || hasPasswordField);
      });
      return isLoggedIn;
    }, 'workatastartup');
    if (ok) return { ok: true, via: 'cookies' };
    // Stale cookie — fall back to a password login if credentials exist.
    if (!email || !password) {
      throw new Error('Session cookie did not authenticate on this site. Re-copy it from a logged-in browser.');
    }
  }

  if (!email || !password) {
    throw new Error('Credentials or a session cookie are required to connect this site.');
  }

  return withPage(async (page) => {
    const continueUrl = encodeURIComponent(`${BASE}/`);
    await page.goto(`${ACCOUNT}/?continue=${continueUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);

    // Step 1: username/email.
    await page.waitForSelector('#ycid-input, input[name="username"]', { timeout: 15000 });
    await page.type('#ycid-input, input[name="username"]', email, { delay: 15 });

    const continueBtn = await page.$('button[type="submit"], form button');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      continueBtn ? safeClick(page, continueBtn, 'continue') : page.keyboard.press('Enter'),
    ]);
    await delay(2500);

    // Step 2: password.
    await page.waitForSelector('#password-input, input[type="password"]', { timeout: 15000 });
    await page.type('#password-input, input[type="password"]', password, { delay: 15 });

    const loginBtn = await page.$('button[type="submit"], form button');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      loginBtn ? safeClick(page, loginBtn, 'login') : page.keyboard.press('Enter'),
    ]);
    await delay(3000);

    const url = page.url();
    // After a successful login, YC redirects to workatastartup.com.
    // If we're still on account.ycombinator.com or see a login form, it failed.
    // Don't check for generic "Log in"/"Sign in" link text — those links can
    // appear in headers/footers even when the user is authenticated.
    const stillOnAuthPage = url.includes('account.ycombinator.com') || /\/login|signin|auth/i.test(url);
    const stillHasPasswordField = !!(await page.$('input[type="password"]'));
    if (stillOnAuthPage || stillHasPasswordField) {
      throw new Error('YC login failed — check your credentials, complete any CAPTCHA, or paste a session cookie instead.');
    }
    return { ok: true, via: 'password' };
  }, 'workatastartup');
}

/**
 * Search the Work at a Startup jobs board. The site has no URL search param,
 * so we load the jobs list and filter the rendered cards by keyword client-side.
 * Returns a normalized job list.
 */
async function searchJobs({ query, location = '', maxJobs = 50 }) {
  const q = normalize(query).toLowerCase();
  return withPage(async (page) => {
    await page.goto(`${BASE}/jobs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    const jobs = [];
    const cards = await page.$$('a[href^="/jobs/"]');
    for (const titleLink of cards) {
      if (jobs.length >= maxJobs) break;
      try {
        // Walk up to the card root (the flex container holding the job info).
        let card = titleLink;
        for (let i = 0; i < 4 && card; i++) {
          card = await titleLink.evaluateHandle((el) => el.closest('div[class*="cursor-pointer"]'));
          if (card) break;
        }
        const cardHandle = card || titleLink;

        const title = await titleLink.evaluate((el) => el.textContent.trim());
        const urlPath = await titleLink.evaluate((el) => el.getAttribute('href') || '');

        const company = await cardHandle.evaluate((el) => {
          const a = el.querySelector('a[href^="/companies/"] span.font-bold, a[href^="/companies/"]');
          return a ? a.textContent.trim() : '';
        }).catch(() => '');

        const details = await cardHandle.evaluate((el) => {
          const p = el.querySelector('.job-details, p[class*="line-clamp"]');
          return p ? p.textContent.replace(/\s+/g, ' ').trim() : '';
        }).catch(() => '');

        const locationRaw = await cardHandle.evaluate((el) => {
          const spans = Array.from(el.querySelectorAll('.job-details span, p[class*="line-clamp"] span'));
          // Location is the span containing a country code / city (2nd one).
          return spans.map((s) => s.textContent.trim()).find((t) => /[A-Z]{2}/.test(t) || /remote/i.test(t)) || '';
        }).catch(() => '');

        const combined = `${title} ${company} ${details}`.toLowerCase();
        // Match if ANY keyword from the query appears in the job card text
        // (the full query string is never a substring of a single card).
        const keywords = q.split(/\s+/).filter(Boolean);
        if (keywords.length && !keywords.some((kw) => combined.includes(kw))) continue;

        const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
        jobs.push({
          title: normalize(title),
          company: normalize(company),
          location: normalize(locationRaw || details),
          url,
          postedText: '',
          description: normalize(details),
          site: 'workatastartup',
        });
      } catch {
        // skip malformed card
      }
    }
    return jobs;
  }, 'workatastartup');
}

/** Fetch the full job description for a Work at a Startup job URL. */
async function fetchJobDescription(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error('Missing job URL');
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500);
    return page.evaluate(() => {
      const body = document.body ? document.body.innerText : '';
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
      // Find the job-title heading, then capture everything up to "Other jobs".
      const start = lines.findIndex((l) => /at\s+.+\(.*\)$/.test(l) || /Senior|Software|Engineer|Developer|Head|Lead|Intern/i.test(l));
      const end = lines.findIndex((l) => /^Other jobs at/i.test(l));
      const slice = lines.slice(Math.max(start, 0), end === -1 ? lines.length : end);
      return slice.join(' ').replace(/\s+/g, ' ').trim();
    });
  }, 'workatastartup');
}

/** Work at a Startup applies via the YC single application — manual apply only. */
async function detectApplyFields() {
  return [];
}

async function submitApplication() {
  return { applied: false, needsManualApply: true, reason: 'YC applications go through the Work at a Startup profile form — apply in the browser.' };
}

module.exports = { login, searchJobs, fetchJobDescription, detectApplyFields, submitApplication };
