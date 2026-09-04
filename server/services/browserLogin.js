/**
 * Assisted browser login: opens a VISIBLE Chrome window on the site's login
 * page, waits for the user to complete login manually (CAPTCHA/OTP/SSO safe),
 * then harvests the session cookies so the headless worker can reuse them.
 *
 * Nothing is hardcoded per site: login URLs, timeouts, and logged-in checks
 * come from SITE_META (loginUrl, slowLogin) and the site's adapter
 * (isAuthenticated). Unknown sites fall back to generic heuristics.
 */

const { launchInteractiveBrowser, delay, cookiesToHeader } = require('../adapters/browser');
const { SITE_META, getAdapter } = require('../adapters');

const POLL_MS = 4000;
const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;

// One interactive login per site at a time — different sites can log in
// concurrently (each has its own Chrome profile), but a second attempt on the
// SAME site would kill the first window's profile lock.
const _busySites = new Set();

/** True while an interactive browser login window is open for `site`. */
function isLoginInProgress(site) {
  return _busySites.has(String(site || '').toLowerCase());
}

const onLoginUrl = (url) => /login|signin|sign-in|nlogin|account\/login|auth/i.test(String(url || ''));

/** True when the page still shows a login form (email/password fields). */
async function stillOnLoginPage(page) {
  try {
    return !!(await page.$('input[type="password"], input[name="password"], form input[type="email"], form input[name="email"]'));
  } catch {
    return false;
  }
}

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

/** True when the page is a rate-limit / bot-challenge interstitial, not the site. */
async function isBlockPage(page) {
  try {
    const text = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 3000));
    return /too many requests|rate limit|429|checking your browser|verify you are human|just a moment|attention required/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Site-specific "is the user logged in now?" check on the current page.
 * Delegates to the adapter's own `isAuthenticated` when it exports one
 * (Naukri/Indeed/Wellfound do); unknown/custom sites fall back to generic
 * heuristics: off any login URL and no visible login form on screen.
 */
async function detectLoggedIn(page, site) {
  try {
    if (onLoginUrl(page.url())) return false;
    // A 429 "too many requests" or Cloudflare challenge page is NOT a logged-in
    // page — harvesting cookies from it produces a bogus session header.
    if (await isBlockPage(page)) return false;
    const adapter = getAdapter(site);
    if (adapter && typeof adapter.isAuthenticated === 'function') {
      return await adapter.isAuthenticated(page);
    }
    // Generic fallback for custom sites: no login CTA / password field visible.
    const state = await page.evaluate(() => {
      const body = (document.body && document.body.innerText) || '';
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const hasVisiblePass = Array.from(document.querySelectorAll('input[type="password"]')).some(isVisible);
      const hasLoginCta = Array.from(document.querySelectorAll('a, button')).some((el) => {
        if (!isVisible(el)) return false;
        const t = (el.textContent || '').trim().toLowerCase();
        return /^(log ?in|sign ?in|login|register|sign ?up)$/.test(t);
      });
      return { hasSession: /logout|log\s*out|my\s*(job)?feed|my\s*profile|view\s*profile|saved\s*jobs/i.test(body.slice(0, 20000)), hasLoginCta, hasVisiblePass };
    });
    return !state.hasVisiblePass && !state.hasLoginCta && state.hasSession;
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
  const key = String(site || '').toLowerCase();
  if (_busySites.has(key)) {
    return { ok: false, reason: 'A login window is already open for this site — complete or close it, then retry.' };
  }
  _busySites.add(key);
  const meta = SITE_META[key] || {};
  // Rate-limited sites (Cloudflare "too many requests") need room to cool down
  // inside the window while the user waits and refreshes manually. The longer
  // window is declared per site in SITE_META (slowLogin) — not hardcoded here.
  const limit = timeoutMs || (meta.slowLogin ? 10 * 60 * 1000 : DEFAULT_TIMEOUT_MS);
  const openUrl = startUrl || meta.loginUrl || meta.homeUrl;

  let browser = null;
  try {
    if (!openUrl) return { ok: false, reason: 'No site URL configured for ' + site };
    const session = await launchInteractiveBrowser(openUrl, {
      site,
      // If the bot wall refuses the deep /login URL, land on the site home
      // page instead — the user can click Login there themselves.
      fallbackUrl: meta.homeUrl && meta.homeUrl !== openUrl ? meta.homeUrl : undefined,
    });
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

      // Two-step/SSO flows (YC, Google SSO, OTP screens) run on a DIFFERENT
      // domain than the site and often show NO password field (username-only
      // step). The user is mid-login there — HANDS OFF the page entirely;
      // navigating away would yank them out of the form they're typing in.
      // The provider redirects back to the site when login completes.
      const onHome = meta.homeUrl && checkUrl.startsWith(meta.homeUrl);
      const crossDomainAuth = !onHome && /account\.|auth\.|login\.|signin\.|accounts\.|\/login|\/signin|\/auth/i.test(checkUrl);
      if (crossDomainAuth) continue;

      // A visible login form means the user is still working — keep waiting.
      // (Naukri and others can leave "login" in the URL AFTER login completes,
      // so the URL alone is not enough.)
      if (await stillOnLoginPage(page)) continue;

      // Off-home on a non-auth URL: verify once from the site home, then
      // harvest only on a confirmed logged-in (non-blocked) page.
      if (!onHome && meta.homeUrl) {
        await page.goto(meta.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await delay(2000);
      }
      const canHarvest = await detectLoggedIn(page, site);
      if (canHarvest) {
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
    _busySites.delete(key);
    if (browser) await browser.close().catch(() => {});
  }
}

// Failures a visible browser window cannot fix (network/DNS/TLS down, missing
// config) — opening an interactive window for these would only waste the user's
// time, so they are reported as plain errors instead.
const NO_INTERACTIVE_FALLBACK_RE = /net::|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_|ERR_SSL|ERR_CERT|ERR_ABORTED|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up|tunneling|getaddrinfo|self.signed|certificate|No site URL configured|not configured|Credentials or a session cookie are required|unknown job site/i;

/** True when a failed automated login is worth retrying in a human browser. */
function needsInteractiveLogin(err) {
  const msg = String((err && err.message) || err || '');
  return Boolean(msg) && !NO_INTERACTIVE_FALLBACK_RE.test(msg);
}

/**
 * Flexible site connect (used by Login All): FIRST try the automated login with
 * the site's OWN stored credentials / session cookie. If that fails for a reason
 * a human browser can fix (CAPTCHA, OTP/2FA, SSO, Cloudflare/bot challenge,
 * stale cookie, changed DOM...), FALL BACK to opening a visible browser window
 * so the user completes the login manually; the session cookies are harvested
 * and returned for the caller to persist (never fails out of the box).
 *
 * @param {{ site, email, password, cookieHeader, origin, userId? }} opts
 * @returns {Promise<{ ok: boolean, via?: 'cookies'|'password'|'browser', cookieHeader?: string, cookieCount?: number, reason?: string }>}
 */
async function connectSite({ site, email, password, cookieHeader, origin, userId } = {}) {
  const key = String(site || '').toLowerCase();
  if (!origin) return { ok: false, reason: 'No site URL configured for ' + site };

  try {
    const adapter = getAdapter(key);
    await adapter.login({
      email,
      password,
      cookies: cookieHeader || undefined,
      cookieOrigin: cookieHeader ? origin : undefined,
      baseUrl: origin,
    });
    // After successful automated login (cookie or password), capture fresh
    // session cookies so the caller (e.g. login-all) can persist the session
    // for reuse by the worker. userId may be provided by the caller; if not,
    // cookie capture is skipped since we don't have the target user's key.
    if (userId) {
      try {
        const { captureCookiesFromContext } = require('../services/sessionRefresh');
        await captureCookiesFromContext(userId, key).catch(() => {});
      } catch {}
    }
    return { ok: true, via: cookieHeader ? 'cookies' : 'password' };
  } catch (err) {
    // Only open a browser window when the failure is something the user can
    // actually resolve there (CAPTCHA/SSO/OTP/stale cookie/DOM). Network and
    // config errors just surface as failures — a window can't fix them either.
    if (!needsInteractiveLogin(err)) {
      return { ok: false, reason: err?.message || 'Connection failed' };
    }
  }

  const result = await interactiveLogin(key);
  if (!result.ok) return { ok: false, via: 'browser', reason: result.reason };
  return { ok: true, via: 'browser', cookieHeader: result.cookieHeader, cookieCount: result.cookieCount };
}

module.exports = { interactiveLogin, isLoginInProgress, connectSite, needsInteractiveLogin, detectLoggedIn, cookiesForSite, siteHostname };
