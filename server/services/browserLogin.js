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

/** Site-specific "is the user logged in now?" check on the current page. */
async function detectLoggedIn(page, site) {
  try {
    if (onLoginUrl(page.url())) return false;
    if (site === 'naukri') {
      // Naukri keeps a visible Login button in the header while logged out.
      const loggedOut = await page.$('.loginBtn, [data-testid="login-button"], a[href*="nlogin/login"]');
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
async function interactiveLogin(site, { timeoutMs = DEFAULT_TIMEOUT_MS, startUrl } = {}) {
  if (_busy) return { ok: false, reason: 'Another browser login is already in progress.' };
  _busy = true;
  const meta = SITE_META[site] || {};
  const openUrl = startUrl || LOGIN_URLS[site] || meta.homeUrl;
  if (!openUrl) return { ok: false, reason: 'No site URL configured for ' + site };

  let browser = null;
  try {
    const session = await launchInteractiveBrowser(openUrl);
    browser = session.browser;
    const page = session.page;

    const deadline = Date.now() + timeoutMs;
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
    return { ok: false, reason: 'Timed out waiting for login — try again and complete login within 4 minutes.' };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Interactive login failed' };
  } finally {
    _busy = false;
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { interactiveLogin, detectLoggedIn, cookiesForSite, siteHostname };
