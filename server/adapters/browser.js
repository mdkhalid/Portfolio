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

async function closeBrowser() {
  if (_browserPromise) {
    const b = await _browserPromise;
    _browserPromise = null;
    await b.close().catch(() => {});
  }
}

module.exports = { getBrowser, newPage, withPage, safeText, safeAttr, delay, closeBrowser };
