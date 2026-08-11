const { withPage, safeText, delay, loginWithCookies } = require('./browser');

/**
 * Generic adapter for user-added (custom) job sites.
 *
 * These sites have no hand-written automation, so the pipeline can only:
 *  - attempt a best-effort login (password form or pasted session cookie), and
 *  - mark jobs as "needs manual apply" so the user applies in the browser.
 * Search / JD fetch / auto-submit are intentionally NOT supported and throw.
 */

async function login({ email, password, cookies, cookieOrigin, baseUrl }) {
  const origin = cookieOrigin || baseUrl;
  if (!origin) throw new Error('Site URL is not configured');

  if (cookies && origin) {
    const ok = await withPage(async (page) => {
      const isLoggedIn = await loginWithCookies(page, cookies, origin, async (p) => {
        // Best-effort "are we logged in?" check that tolerates sites which
        // keep a hidden login form/modal in the DOM (e.g. hirist, Indeed).
        const url = p.url();
        if (/\/login|signin|log-in|sign-in|\/auth/i.test(url)) {
          throw new Error(`Redirected to auth page (${url}) — cookie was not accepted.`);
        }
        const state = await p.evaluate(() => {
          const body = (document.body && document.body.innerText) || '';
          const isVisible = (el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
          };
          // Visible links/buttons whose text is a login/register CTA. Matches
          // sites (like hirist) whose login controls aren't href*="login".
          const cta = (sel) => Array.from(document.querySelectorAll(sel)).some((el) => {
            if (!isVisible(el)) return false;
            const t = (el.textContent || '').trim().toLowerCase();
            return /^(log ?in|sign ?in|login|register|sign ?up|create account|join now)$/.test(t) ||
              /^\s*(log ?in|sign ?in|register|sign ?up)/.test(t);
          });
          const pass = (sel) => Array.from(document.querySelectorAll(sel)).some(isVisible);
          return {
            // Logged-in indicators (profile menu, logout, user dashboard).
            hasSession: /logout|log\s*out|my\s*(job)?feed|my\s*profile|update\s*profile|view\s*profile|saved\s*jobs/i.test(body.slice(0, 20000)),
            // Logged-out prompts visible on screen.
            hasLoginPrompt: cta('a, button'),
            hasVisiblePass: pass('input[type="password"], input[name*="password"]'),
          };
        });
        // A clearly visible login/register CTA (and no session markers) means
        // the injected cookie was not honored.
        if (!state.hasSession && (state.hasLoginPrompt || state.hasVisiblePass)) {
          throw new Error('Site still shows the login page — the session cookie was not accepted.');
        }
        return true;
      });
      return isLoggedIn;
    });
    if (ok) return { ok: true, via: 'cookies' };
    // Stale cookie — fall back to a password login if credentials exist.
    if (!email || !password) {
      throw new Error('Session cookie did not authenticate on this site. Re-copy it from a logged-in browser.');
    }
  }

  if (!email || !password) {
    throw new Error('Credentials or a session cookie are required to connect a custom site.');
  }

  // Best-effort generic password login: load the site, find email/password
  // fields, fill and submit. This cannot be reliable for every site; failures
  // return a structured error so the UI can suggest the cookie path instead.
  return withPage(async (page) => {
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    // Try to navigate to a login page if we're not already on one.
    const loginLink = await page.$('a[href*="login"], a[href*="signin"], a[href*="log-in"]');
    if (loginLink && !(await page.$('input[type="password"]'))) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        loginLink.click(),
      ]);
      await delay(2000);
    }

    const emailSel = 'input[type="email"], input[name*="email"], input[name*="user"], input[name*="login"], input[type="text"][name*="mail"]';
    const passSel = 'input[type="password"]';
    const emailInput = await page.$(emailSel);
    const passInput = await page.$(passSel);
    if (!emailInput || !passInput) {
      throw new Error('Could not find a login form on this site. Use the "paste session cookie" option instead.');
    }

    await emailInput.type(email);
    await passInput.type(password);

    const submit = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")');
    if (!submit) {
      await page.keyboard.press('Enter');
    } else {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        submit.click(),
      ]);
    }
    await delay(3000);

    const url = page.url();
    if (/login|signin|log-in|sign-in/i.test(url)) {
      throw new Error('Login appears to have failed (still on a login page). Try the session cookie instead.');
    }
    const passAfter = await page.$('input[type="password"]');
    if (passAfter) {
      throw new Error('Login could not be confirmed (password field still present). Try the session cookie instead.');
    }
    return { ok: true, via: 'password' };
  });
}

async function searchJobs() {
  throw new Error('This site has no auto-search support. Add jobs manually from the Manual Apply tab.');
}

async function fetchJobDescription() {
  throw new Error('This site has no JD auto-fetch support.');
}

async function detectApplyFields() {
  return [];
}

async function submitApplication() {
  throw new Error('This site is not automated — apply manually and mark it applied in the Manual Apply list.');
}

module.exports = { login, searchJobs, fetchJobDescription, detectApplyFields, submitApplication };
