let _browserPromise = null;
let _puppeteer = null;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--lang=en-US',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
];

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
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  );
  // Remove webdriver flag so sites can't detect Puppeteer.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Remove Puppeteer-specific properties
    delete navigator.__proto__.webdriver;
  });
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
 *
 * If `checkLoggedIn` throws, the error is rethrown so callers can surface the
 * specific reason (e.g. "redirected to auth page") instead of a generic
 * "did not authenticate" message.
 */
async function loginWithCookies(page, cookieHeader, originUrl, checkLoggedIn) {
  const set = await setCookiesFromHeader(page, cookieHeader, originUrl);
  if (!set) return false;
  await page.goto(originUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await delay(2000);
  if (typeof checkLoggedIn !== 'function') return true;
  try {
    return Boolean(await checkLoggedIn(page));
  } catch (err) {
    if (err instanceof Error && /(auth page|login page|login form|cookie was not accepted)/i.test(err.message)) throw err;
    return false;
  }
}

/**
 * Upload a resume (Buffer) into a visible or hidden file input on the page.
 * Writes the bytes to a temp file, uploads via Puppeteer's uploadFile (which
 * bypasses the file chooser dialog), then cleans up. Returns true on success.
 */
async function uploadResumeFile(page, resumeBuffer, filename = 'resume.pdf') {
  if (!resumeBuffer) return false;
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  let tempPath = '';
  try {
    const safe = String(filename || 'resume.pdf').replace(/[^\w.\-]/g, '_').slice(-80) || 'resume.pdf';
    tempPath = path.join(os.tmpdir(), 'resume-' + Date.now() + '-' + safe);
    fs.writeFileSync(tempPath, resumeBuffer);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) return false;
    await fileInput.uploadFile(tempPath);
    await delay(1200);
    return true;
  } catch (err) {
    console.error('[browser] resume upload failed:', err?.message || err);
    return false;
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }
  }
}

/**
 * Click the first visible button/link whose text contains any of `texts`
 * (case-insensitive). Falls back to label matching when sites obfuscate
 * selectors. Returns true if something was clicked.
 */
async function clickButtonByText(page, texts) {
  if (!Array.isArray(texts) || !texts.length) return false;
  const wanted = texts.map((t) => String(t).toLowerCase()).filter(Boolean);
  try {
    return await page.evaluate((list) => {
      const nodes = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]'));
      for (const el of nodes) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
        const text = (el.textContent || el.value || '').trim().toLowerCase();
        if (list.some((w) => text.includes(w))) {
          el.click();
          return true;
        }
      }
      return false;
    }, wanted);
  } catch {
    return false;
  }
}

/** Read the apply button + page state so callers can confirm a real submit. */
async function readApplyState(page, applySelector) {
  const sel = applySelector || 'button[class*="apply"], a[class*="apply"], button[data-testid="applyButton"]';
  try {
    const state = await page.evaluate((selExp) => {
      const body = (document.body && document.body.innerText) || '';
      const btn = document.querySelector(selExp);
      const btnText = btn ? (btn.textContent || '').trim().toLowerCase() : '';
      return {
        successText: /you have applied|application submitted|successfully applied|applied successfully|your application has been sent|thank you for applying|already applied/i.test(body.slice(0, 6000)),
        btnText,
        btnPresent: !!btn,
        btnDisabled: btn ? btn.disabled === true || btn.getAttribute('aria-disabled') === 'true' : false,
      };
    }, sel);
    return state;
  } catch (err) {
    // The page navigated while we were reading it (common after a successful
    // submit redirects to a confirmation page). Return null so confirmApplied
    // treats it as "unknown" and defaults to applied:true rather than failing.
    return null;
  }
}

/**
 * Interpret `readApplyState` output: an apply button whose label switched to
 * "Applied"/"Submitted" (or disappeared, or is disabled) means the application
 * went through; a still-active "Apply"-labelled button means it didn't.
 */
function confirmApplied(state) {
  if (!state) return { applied: true };
  if (state.successText) return { applied: true };
  const stillApply = state.btnPresent && !state.btnDisabled
    && /apply|submit|register/.test(state.btnText)
    && !/applied|submitted|done/.test(state.btnText);
  if (stillApply) return { applied: false };
  return { applied: true };
}

module.exports = { getBrowser, newPage, withPage, safeText, safeAttr, delay, setCookiesFromHeader, loginWithCookies, closeBrowser, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied };
