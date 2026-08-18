const { withPage, delay, loginWithCookies, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick, gotoWithBackoff, blockError } = require('./browser');
const { detectFields, fillFields } = require('../services/applyFields');

const BASE = 'https://wellfound.com';

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** True when the page shows a logged-in Wellfound (no Log In nav, no block page). */
async function isLoggedInPage(page) {
  const url = page.url();
  if (/\/login|\/signup|\/users\/sign_in/i.test(url)) return false;
  const body = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 3000)).catch(() => '');
  if (/too many requests|rate limit|checking your browser|verify you are human|just a moment/i.test(body)) return false;
  const loggedOut = await page.$('header a[href*="/login"], header a[href*="/signup"], nav a[href*="/login"]').catch(() => null);
  return !loggedOut;
}

/**
 * Log in to Wellfound. Order: saved cookie header → the persistent browser
 * profile (session earned via the Login via Browser button) → email/password.
 * Cloudflare fronts the site, so real failures are reported as clear
 * rate-limit / bot-block errors instead of generic "cookie not accepted".
 */
async function login({ email, password, cookies, cookieOrigin }) {
  if (cookies && cookieOrigin) {
    const ok = await withPage(async (page) =>
      loginWithCookies(page, cookies, cookieOrigin, isLoggedInPage), 'wellfound');
    if (ok) return { ok: true, via: 'cookies' };
  }

  // The persistent profile may already hold the session — one navigation to
  // confirm, no login-form traffic (keeps Wellfound's rate limit happy).
  const profileOk = await withPage(async (page) => {
    const resp = await gotoWithBackoff(page, BASE, { timeout: 40000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('Wellfound: ' + blocked);
    await delay(2000);
    return isLoggedInPage(page);
  }, 'wellfound');
  if (profileOk) return { ok: true, via: 'profile' };

  if (!email || !password) {
    throw new Error('Wellfound session not found — use the "Login via Browser" button on the Job Sites tab to log in once.');
  }

  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, `${BASE}/login`, { timeout: 35000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('Wellfound: ' + blocked);
    await delay(3000);

    const emailSel = '#user_email, input[name="user[email]"], input[type="email"]';
    const pwSel = '#user_password, input[name="user[password]"], input[type="password"]';

    const hasForm = await page.$(emailSel);
    if (!hasForm) {
      throw new Error('Wellfound login requires Cloudflare or SSO verification. Use the "Login via Browser" button to connect.');
    }

    await page.type(emailSel, email, { delay: 20 });
    await page.type(pwSel, password, { delay: 20 });

    const submitBtn = await page.$('input[type="submit"], button[type="submit"], form button');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      submitBtn ? safeClick(page, submitBtn, 'login submit') : page.keyboard.press('Enter'),
    ]);
    await delay(3000);

    const url = page.url();
    const hasError = await page.$('.flash-error, [data-test="error-message"], .alert-danger');
    if (url.includes('/login') || hasError) {
      const msg = hasError ? await hasError.evaluate((el) => el.innerText).catch(() => '') : '';
      throw new Error(msg || 'Wellfound login failed — use the "Login via Browser" button to solve CAPTCHA/SSO.');
    }
    return { ok: true, via: 'password' };
  }, 'wellfound');
}

/**
 * Search jobs on Wellfound.
 *
 * Wellfound's keyword search is a client-side react-select form — the
 * `?keyword=` URL param is NOT honored by the server, so we type the query and
 * click the Search button, then scrape the rendered job cards.
 */
async function searchJobs({ query, location, pageCount = 1, maxJobs = 30 } = {}) {
  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, `${BASE}/jobs`, { timeout: 40000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('Wellfound: ' + blocked);
    await delay(3000);

    const q = String(query || '').trim();
    if (q) {
      // Logged-in Wellfound renders a global search box (#search); the public
      // react-select "Job title" input is a fallback for the logged-out view.
      const input = await page.$('#search, input[id^="react-select-"]').catch(() => null);
      if (input) {
        await input.click({ clickCount: 3 }).catch(() => {});
        await page.keyboard.type(q, { delay: 25 }).catch(() => {});
        await delay(400);
        // Press Enter to run the global search (no visible Search button in the
        // logged-in header) or click Search if the public form is shown.
        await page.keyboard.press('Enter').catch(() => {});
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => (b.textContent || '').trim() === 'Search'
          );
          if (btn) btn.click();
        }).catch(() => {});
        await delay(4000);
      }
    }

    // Auto-scroll gently to load dynamic job cards (fewer, slower scrolls —
    // Wellfound's rate limiter watches bursty automation patterns).
    for (let s = 0; s < 2; s++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await delay(1500);
    }

    const jobs = await page.evaluate((base) => {
      const results = [];
      const seen = new Set();

      // Wellfound renders job cards as <a href="/jobs/<id>-<slug>"> with the
      // real fields inside specific styled spans. The company is a separate
      // preceding card, so we remember the last clean company name seen.
      const anchors = Array.from(document.querySelectorAll('a'));
      let lastCompany = '';

      for (const link of anchors) {
        const href = link.getAttribute('href') || '';

        if (href.startsWith('/company/')) {
          const t = (link.textContent || '').replace(/\s+/g, ' ').trim();
          // Only the clean "Company" text link (not the promo card with
          // description/employee count) becomes the active company.
          if (t && t.length <= 60 && !/promoted|employees|actively hiring|top \d+%|responds/i.test(t)) {
            lastCompany = t;
          }
          continue;
        }

        if (!/^\/jobs\/\d+/.test(href) || seen.has(href)) continue;
        seen.add(href);

        const title = link.querySelector('.styles_title__xpQDw')
          ? link.querySelector('.styles_title__xpQDw').textContent.replace(/\s+/g, ' ').trim()
          : (link.textContent || '').replace(/\s+/g, ' ').trim();

        if (!title) continue;

        const locEls = link.querySelectorAll('.styles_location__O9Z62');
        const location = Array.from(locEls).map((el) => (el.textContent || '').trim()).join(', ') || 'Remote';
        const salaryEl = link.querySelector('.styles_compensation__3JnvU');
        const salary = salaryEl ? (salaryEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        results.push({
          title,
          company: lastCompany || 'Startup',
          location,
          salary,
          url: href.startsWith('http') ? href : base + href,
          site: 'wellfound',
          postedDate: new Date(),
        });
      }
      return results;
    }, BASE);

    return jobs.slice(0, maxJobs);
  }, 'wellfound');
}

/**
 * Fetch the full job description.
 */
async function fetchJobDescription({ url }) {
  if (!url) return '';
  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, url, { timeout: 35000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('Wellfound: ' + blocked);
    await delay(2000);

    const desc = await page.evaluate(() => {
      const descEl = document.querySelector('[data-test="JobDescription"], [class*="styles_description"], div[class*="description"], article');
      return descEl ? descEl.innerText.trim() : (document.body ? document.body.innerText.slice(0, 5000) : '');
    });

    return { description: desc || '' };
  }, 'wellfound');
}

/**
 * Submit application on Wellfound.
 */
async function submitApplication({ url, credentials, resume, resumeFilename, fields = {}, detected = [] }) {
  if (!url) throw new Error('No job URL provided for Wellfound application');

  return withPage(async (page) => {
    const resp = await gotoWithBackoff(page, url, { timeout: 40000 });
    const blocked = blockError(resp);
    if (blocked) throw new Error('Wellfound: ' + blocked);
    await delay(2500);

    const applyBtn = await page.$('button[data-test="JobApplicationApplyButton"], button[data-test="ApplyButton"], button[class*="styles_applyButton"], a[data-test="ApplyButton"]');
    if (!applyBtn) {
      // Fallback: click a visible button whose text contains "Apply".
      const clicked = await clickButtonByText(page, ['apply now', 'apply']);
      if (!clicked) {
        const state = await readApplyState(page);
        if (state && !state.btnPresent) {
          return { applied: true, note: 'Already applied or direct apply' };
        }
        throw new Error('No apply button found on Wellfound job page.');
      }
    } else {
      await safeClick(page, applyBtn, 'Wellfound Apply button');
    }
    await delay(2000);

    // If there is a note / pitch box:
    const noteArea = await page.$('textarea[name="note"], textarea[placeholder*="pitch"], textarea[placeholder*="note"], textarea');
    if (noteArea) {
      const noteText = fields.pitch || fields.cover_letter || fields.note || 'Excited to apply! I have relevant full-stack software engineering experience and would love to connect.';
      await noteArea.type(noteText, { delay: 10 });
    }

    // Detect & fill standard form fields if a modal or multi-field form popped up
    const formFields = await detectFields(page);
    if (formFields.length) {
      await fillFields(page, fields, formFields);
    }

    if (resume) {
      await uploadResumeFile(page, resume, resumeFilename || 'resume.pdf');
    }

    // Find submit button in dialog/modal
    const sendBtn = await page.$('button[data-test="SendApplicationButton"], button[type="submit"]');
    if (sendBtn) {
      await safeClick(page, sendBtn, 'Send Application');
    } else {
      await clickButtonByText(page, ['send application', 'submit application', 'submit']);
    }
    await delay(3000);

    const state = await readApplyState(page);
    return confirmApplied(state);
  }, 'wellfound');
}

module.exports = {
  login,
  searchJobs,
  fetchJobDescription,
  submitApplication,
};
