const { launchInteractiveBrowser, delay, cookiesToHeader } = require('../adapters/browser');
const { SITE_META } = require('../adapters');

/**
 * Assisted browser login: opens a VISIBLE Chrome window on the site's login
 * page, waits for the user to complete login manually (CAPTCHA/OTP/SSO safe),
 * then harvests the session cookies so the headless worker can reuse them.
 */

// Where to open the interactive window for each built-in site.
const LOGIN_URLS = {
  naukri: 'https://www.naukri.com/nlogin/login',
  indeed: 'https://secure.indeed.com/account/login',
  workatastartup: 'https://www.workatastartup.com/login',
  wellfound: 'https://wellfound.com/login',
};

const POLL_MS = 4000;
const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;

let _busy = false;

const onLoginUrl = (url) => /login|signin|sign-in|nlogin|account\/login|auth/i.test(String(url || ''));

/** Base hostname of a site ("https://www.naukri.com" -> "naukri.com"). */
function siteHostname(site) {
  const home = (SITE_META[site] || {}).homeUrl || '';
  try {
    return new URL(home).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Keep only cookies whose domain belongs to the site (incl. sub/parent
 * domains like .naukri.com). Third-party/analytics cookies are dropped.
 */
function cookiesForSite(cookies, site) {
  const host = siteHostname(site);
  if (!host) return cookies || [];
  return (cookies || []).filter((c) => (c.domain || '').replace(/^\./, '').endsWith(host));
}

/** True while the launched browser process is still alive (puppeteer v25-safe). */
function browserAlive(browser) {
  try {
    if (browser.process() === null) return false;
    // isConnected() was removed in newer Puppeteer; use it only when present.
    if (typeof browser.isConnected === 'function') return browser.isConnected();
    return true;
  } catch {
    return false;
  }
}

// Sites that need longer to log in manually (rate limits / Cloudflare waits).
const LONG_LOGIN_SITES = new Set(['wellfound']);

/** True when the page is a rate-limit / bot-challenge interstitial, not the site. */
async function isBlockPage(page) {
  try {
    const text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 3000));
    return /too many requests|rate limit|429|checking your browser|verify you are human|just a moment|attention required/i.test(text);
  } catch {
    return false;
  }
}

/** Site-specific "is the user logged in now?" check on the current page. */
async function detectLoggedIn(page, site) {
  try {
    if (onLoginUrl(page.url())) return false;
    // A 429 "too many requests" or Cloudflare challenge page is NOT a logged-in
    // page — harvesting cookies from it produces a bogus session header.
    if (await isBlockPage(page)) return false;
    if (site === 'naukri') {
      // Naukri keeps a visible Login button in the header while logged out.
      const loggedOut = await page.$('.loginBtn, [data-testid="login-button"], a[href*="nlogin/login"]');
      return !loggedOut;
    }
    if (site === 'wellfound') {
      // Logged-out pages show Log In / Sign Up links in the header nav.
      const loggedOut = await page.$('header a[href*="/login"], header a[href*="/signup"], nav a[href*="/login"]');
      return !loggedOut;
    }
    // Generic: off the login URL and page has a body → best-effort success.
    return true;
  } catch {
    return false; // page mid-navigation — try again next poll
  }
}

/**
 * Run one interactive login session for a site.
 * @param {string} site - site name (e.g. 'naukri')
 * @param {{ timeoutMs?: number, startUrl?: string }} [opts]
 * @returns {Promise<{ ok: boolean, cookieHeader?: string, cookieCount?: number, reason?: string }>}
 */
async function interactiveLogin(site, { timeoutMs, startUrl } = {}) {
  if (_busy) return { ok: false, reason: 'Another browser login is already in progress.' };
  _busy = true;
  // Rate-limited sites (Cloudflare "too many requests") need room to cool down
  // inside the window while the user waits and refreshes manually.
  const limit = timeoutMs || (LONG_LOGIN_SITES.has(site) ? 10 * 60 * 1000 : DEFAULT_TIMEOUT_MS);
  const meta = SITE_META[site] || {};
  const openUrl = startUrl || LOGIN_URLS[site] || meta.homeUrl;
  if (!openUrl) return { ok: false, reason: 'No site URL configured for ' + site };

  let browser = null;
  try {
    const session = await launchInteractiveBrowser(openUrl, { site });
    browser = session.browser;
    const page = session.page;

    // The window opened but the login page never loaded (profile lock, network,
    // site down). Waiting would just stare at a blank window — bail with the
    // actual navigation error so the toast explains what went wrong.
    if (session.navError) {
      return {
        ok: false,
        reason: `The login page did not load (${session.navError}). Try the Login via Browser button again — stale browser processes are cleaned up automatically.`,
      };
    }

    const deadline = Date.now() + limit;
    while (Date.now() < deadline) {
      await delay(POLL_MS);
      // If the browser window was closed by the user, stop waiting.
      if (!browserAlive(browser)) {
        return { ok: false, reason: 'Browser window was closed before login completed.' };
      }
      let checkUrl = '';
      try { checkUrl = page.url(); } catch { continue; }
      if (onLoginUrl(checkUrl)) continue; // still on a login/auth page

      // Left the login page → verify from the site home, then harvest cookies.
      if (meta.homeUrl && !checkUrl.startsWith(meta.homeUrl)) {
        await page.goto(meta.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await delay(2000);
      }
      if (await detectLoggedIn(page, site)) {
        // Harvest ALL site cookies (every sub/parent domain), not just the
        // ones visible from the home URL — auth tokens often live on the
        // parent domain or a subdomain.
        const cookies = cookiesForSite(await page.cookies().catch(() => []), site);
        const header = cookiesToHeader(cookies);
        if (header) {
          return { ok: true, cookieHeader: header, cookieCount: cookies.length };
        }
      }
    }
    return { ok: false, reason: `Timed out waiting for login — try again and complete login within ${Math.round(limit / 60000)} minutes.` };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Interactive login failed' };
  } finally {
    _busy = false;
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { interactiveLogin, detectLoggedIn, cookiesForSite, siteHostname };
