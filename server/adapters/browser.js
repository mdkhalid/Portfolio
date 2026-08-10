let _browserPromise = null;
let _puppeteer = null;

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--lang=en-US'];

async function getBrowser() {
  if (!_browserPromise) {
    // Lazy-require so requiring the adapters never pulls in puppeteer's ESM
    // entry (jest/CommonJS contexts that never launch a browser stay clean).
    if (!_puppeteer) {
      _puppeteer = require('puppeteer');
    }
    _browserPromise = _puppeteer.launch({
      headless: 'new',
      args: LAUNCH_ARGS,
      defaultViewport: { width: 1366, height: 768 },
    });
    _browserPromise.catch(() => {
      _browserPromise = null;
    });
  }
  return _browserPromise;
}

async function newPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  return page;
}

/** Shortcut: create a page, run fn(page), always close the page. */
async function withPage(fn) {
  const page = await newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

const isHandle = (el) => !!(el && typeof el.$ === 'function' && typeof el.evaluate === 'function');

/**
 * Best-effort text extraction from a selector. Works with a Page or an
 * ElementHandle as the first argument; returns '' if absent.
 */
async function safeText(pageOrHandle, selector, timeout = 5000) {
  try {
    if (isHandle(pageOrHandle)) {
      const child = await pageOrHandle.$(selector);
      return child ? await pageOrHandle.evaluate((el, sel) => {
        const node = el.querySelector(sel);
        return node ? (node.textContent || '').trim() : '';
      }, pageOrHandle, selector) : '';
    }
    await pageOrHandle.waitForSelector(selector, { timeout });
    return await pageOrHandle.$eval(selector, (el) => el.textContent.trim());
  } catch {
    return '';
  }
}

/** Best-effort attribute extraction; returns '' if absent. */
async function safeAttr(pageOrHandle, selector, attr, timeout = 5000) {
  try {
    if (isHandle(pageOrHandle)) {
      const child = await pageOrHandle.$(selector);
      return child ? await pageOrHandle.evaluate((el, sel, name) => {
        const node = el.querySelector(sel);
        return node ? (node.getAttribute(name) || '') : '';
      }, pageOrHandle, selector, attr) : '';
    }
    await pageOrHandle.waitForSelector(selector, { timeout });
    return await pageOrHandle.$eval(selector, (el) => el.getAttribute(attr) || '');
  } catch {
    return '';
  }
}

/** Simple delay (replaces Puppeteer's removed page.waitForTimeout). */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inject a raw "Cookie" header string (from DevTools -> Network -> Request headers)
 * into a page so the site treats the session as logged in without a password login.
 * `originUrl` must be a full URL for the cookie's domain (e.g. https://www.naukri.com).
 * Returns the number of cookies set; resolves 0 on any parse/set failure.
 */
async function setCookiesFromHeader(page, cookieHeader, originUrl) {
  if (!cookieHeader || typeof cookieHeader !== 'string' || !cookieHeader.trim() || !originUrl) return 0;
  try {
    const cookies = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq <= 0) return null;
        return {
          name: part.slice(0, eq).trim(),
          value: part.slice(eq + 1).trim(),
          url: originUrl,
        };
      })
      .filter(Boolean);
    if (!cookies.length) return 0;
    await page.setCookie(...cookies);
    return cookies.length;
  } catch {
    return 0;
  }
}

async function closeBrowser() {
  if (_browserPromise) {
    const b = await _browserPromise;
    _browserPromise = null;
    await b.close().catch(() => {});
  }
}

/**
 * Try to restore a logged-in session from a raw Cookie header string.
 * Injects the cookies for `originUrl`, loads the site, and returns whether
 * `checkLoggedIn(page)` reports an active session. `checkLoggedIn` defaults
 * to true once cookies are injected (best-effort).
 */
async function loginWithCookies(page, cookieHeader, originUrl, checkLoggedIn) {
  const set = await setCookiesFromHeader(page, cookieHeader, originUrl);
  if (!set) return false;
  await page.goto(originUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await delay(2000);
  if (typeof checkLoggedIn !== 'function') return true;
  try {
    return Boolean(await checkLoggedIn(page));
  } catch {
    return false;
  }
}

module.exports = { getBrowser, newPage, withPage, safeText, safeAttr, delay, setCookiesFromHeader, loginWithCookies, closeBrowser };
