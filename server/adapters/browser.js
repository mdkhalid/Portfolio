const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let _puppeteer = null;
// One headless browser per profile key ('default' = ephemeral, no userDataDir).
const _browserPromises = new Map();
// Back-compat alias for callers that only track the shared default browser.
let _browserPromise = null;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--lang=en-US',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  // A profile left by a killed/crashed Chrome otherwise shows a "Restore
  // pages?" bubble that steals focus from automation clicks.
  '--hide-crash-restore-bubble',
];

// Chrome exiting immediately with 4294967295 / "Failed to launch the browser
// process" is almost always a stale profile lock (a chrome.exe that outlived
// the previous server run) — not a permanent condition.
const LAUNCH_FAILURE_RE = /Failed to launch the browser|Process failed to spawn|browser process.*exit|singleton/i;

/**
 * Launch Puppeteer with bounded retries for transient Windows profile-lock
 * crashes: kill stray profile holders and back off between attempts.
 */
async function launchWithRetry(launchOptions, site) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      if (site) {
        await killProfileProcesses(site);
        await delay(1500 + attempt * 1500);
      } else {
        await delay(1000 + attempt * 1000);
      }
    }
    try {
      return await _puppeteer.launch(launchOptions);
    } catch (err) {
      lastErr = err;
      if (!LAUNCH_FAILURE_RE.test(String(err?.message || err))) throw err;
      console.warn(`[browser] launch attempt ${attempt + 1}/3 failed${site ? ` (${site})` : ''}: ${err?.message || err}`);
    }
  }
  throw lastErr;
}

// Sites with aggressive bot protection (Cloudflare/DataDome). Their clearance
// cookies are bound to the browser fingerprint that earned them, and headless
// Chrome has a different fingerprint — so these sites run in a REAL (headed)
// Chrome parked off-screen. Logged-in sessions earned in the interactive
// login window then survive in the headless worker.
const HEADED_SITES = new Set(['wellfound']);

/** Get or create a persistent user data directory for a specific job site. */
function getProfileDir(site = 'default') {
  const safeSite = String(site || 'default').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  const dir = path.join(__dirname, '..', 'data', 'browser_profiles', safeSite);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // best-effort
  }
  return dir;
}

/**
 * Force-kill stray Chrome processes still holding a site's persistent profile
 * (left behind by a crashed server or a killed login window). Chrome locks the
 * profile directory per process, so a stale lock makes the NEXT launch open a
 * window that never loads any page. Scoped strictly to processes whose command
 * line references the profile directory; best-effort, never throws.
 */
function killProfileProcesses(site) {
  const dir = getProfileDir(site);
  // Also match the dedicated interactive-login subdir — without it, a stuck
  // login window would survive a "clean up the profile" kill.
  const interactiveDir = path.join(dir, 'interactive-login');
  return new Promise((resolve) => {
    const finish = () => resolve();
    if (process.platform === 'win32') {
      const safeDir = dir.replace(/'/g, "''");
      const safeInteractive = interactiveDir.replace(/'/g, "''");
      const script =
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
        `Where-Object { $_.CommandLine -like '*${safeDir}*' -or $_.CommandLine -like '*${safeInteractive}*' } | ` +
        `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000 }, () => finish());
    } else {
      execFile('pkill', ['-f', dir], { timeout: 15000 }, () => finish());
    }
  });
}

// Sites with an interactive login window currently open (profile in use by
// the user, not by stray processes) — protects them from cleanup kills.
const _interactiveSites = new Set();

function _evictBrowser(key) {
  _browserPromises.delete(key);
  if (key === 'default') _browserPromise = null;
}

async function getBrowser(site) {
  const key = site ? String(site).toLowerCase() : 'default';
  // A cached browser may have launched fine but then crashed/disconnected
  // silently (OOM, OS reclaim, profile lock). A dead-but-resolved promise would
  // otherwise be returned forever, so every page opened on it throws
  // "Connection closed." Evict it here so the next call relaunches a live one.
  if (_browserPromises.has(key)) {
    const existing = await _browserPromises.get(key).catch(() => null);
    if (existing && typeof existing.isConnected === 'function' && !existing.isConnected()) {
      _evictBrowser(key);
    }
  }
  if (!_browserPromises.has(key)) {
    // Reserve the slot SYNCHRONOUSLY before any await: concurrent callers
    // (worker submit + scheduler cookie refresh + match JD fetch share the
    // per-site browser) must all receive the SAME launch promise, otherwise
    // both pass the has(key) check and launch two Chromes on one profile.
    const promise = (async () => {
      // Lazy-require so requiring the adapters never pulls in puppeteer's ESM
      // entry (jest/CommonJS contexts that never launch a browser stay clean).
      if (!_puppeteer) {
        _puppeteer = require('puppeteer');
      }
      if (site && !_interactiveSites.has(key)) {
        // A crashed/killed server can leave headless Chrome holding the profile
        // lock; clear it so this fresh launch actually works.
        await killProfileProcesses(site);
        await delay(500);
      }
      const launchOptions = {
        headless: 'new',
        args: LAUNCH_ARGS,
        defaultViewport: { width: 1366, height: 768 },
      };
      if (site) {
        launchOptions.userDataDir = getProfileDir(site);
        if (HEADED_SITES.has(key)) {
          // Real Chrome (matches the interactive-login fingerprint), hidden
          // off-screen so the user never sees it flash during auto-apply.
          launchOptions.headless = false;
          launchOptions.args = [...LAUNCH_ARGS, '--window-position=-32000,-32000', '--window-size=1366,768'];
        }
      }
      return launchWithRetry(launchOptions, site);
    })();
    _browserPromises.set(key, promise);
    if (key === 'default') _browserPromise = promise;
    promise
      .then((b) => {
        // If Chrome dies at runtime, drop it from the cache so the next
        // getBrowser() call relaunches a fresh instance instead of returning
        // the dead one (which would keep throwing "Connection closed").
        b.on('disconnected', () => _evictBrowser(key));
      })
      .catch(() => _evictBrowser(key));
  }
  return _browserPromises.get(key);
}

// Open-page count + last-use timestamp per site key — feeds the idle reaper.
const _pageCounts = new Map();
const _lastUsed = new Map();

async function newPage(site) {
  const key = site ? String(site).toLowerCase() : 'default';
  const browser = await getBrowser(site);
  const page = await browser.newPage();
  _pageCounts.set(key, (_pageCounts.get(key) || 0) + 1);
  _lastUsed.set(key, Date.now());
  page.once('close', () => {
    _pageCounts.set(key, Math.max(0, (_pageCounts.get(key) || 1) - 1));
  });
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
async function withPage(fn, site) {
  const page = await newPage(site);
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
  const promises = [..._browserPromises.values()];
  _browserPromises.clear();
  _browserPromise = null;
  for (const promise of promises) {
    const b = await promise.catch(() => null);
    if (b) await b.close().catch(() => {});
  }
}

/**
 * Close only the headless browser holding a given site's persistent profile,
 * releasing the Chrome profile-directory lock before an interactive login on
 * the same site. Browsers for other sites keep running untouched.
 */
async function closeBrowserForSite(site) {
  const key = site ? String(site).toLowerCase() : 'default';
  const promise = _browserPromises.get(key);
  if (!promise) return;
  _browserPromises.delete(key);
  if (key === 'default') _browserPromise = null;
  const b = await promise.catch(() => null);
  if (b) await b.close().catch(() => {});
}

// Idle reaper: site browsers used to stay cached forever once opened — the
// headed ones (Wellfound) keep a permanent Chrome taskbar entry visible even
// though their window is parked off-screen. Profiles persist on disk, so
// closing an idle browser loses nothing; the next use relaunches it.
let _reaperStarted = false;
function startIdleReaper() {
  if (_reaperStarted) return;
  _reaperStarted = true;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const key of [..._browserPromises.keys()]) {
      if (key === 'default' || _interactiveSites.has(key)) continue;
      if ((_pageCounts.get(key) || 0) > 0) continue;
      const last = _lastUsed.get(key) || 0;
      if (now - last < 5 * 60 * 1000) continue;
      closeBrowserForSite(key);
    }
  }, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
startIdleReaper();

/**
 * Launch a DEDICATED visible (headed) browser for interactive login. The user
 * completes login (CAPTCHA/OTP/SSO included) in the window; the caller then
 * harvests the session cookies. Independent of the shared headless instance.
 * Any stray Chrome process still holding this site's persistent profile is
 * killed first — a stale lock makes the new window open but never load pages.
 * @param {string} [startUrl] - page to open immediately
 * @param {{ site?: string }} [opts]
 * @returns {Promise<{ browser: import('puppeteer').Browser, page: import('puppeteer').Page, navError: string | null }>}
 */
async function launchInteractiveBrowser(startUrl, { site } = {}) {
  // Release this site's profile lock only (other sites keep their sessions).
  // The worker's off-screen headed browser (HEADED_SITES, e.g. Wellfound) holds
  // a lock on the shared profile dir; if it is still alive the interactive
  // window would open a blank, non-navigating window because it can't acquire
  // the same user-data-dir. We must fully release that lock first.
  if (site) {
    await closeBrowserForSite(site);
    await killProfileProcesses(site);
    // Wait until Chrome actually releases the SingletonLock on disk (closing is
    // async and the OS can lag a beat, especially on Windows) — launching too
    // early is exactly what produced a blank login window before.
    const lockPath = path.join(getProfileDir(site), 'SingletonLock');
    for (let i = 0; i < 30; i++) {
      if (!fs.existsSync(lockPath)) break;
      await delay(400);
    }
  }

  if (!_puppeteer) _puppeteer = require('puppeteer');
  const launchOptions = {
    headless: false,
    args: [...LAUNCH_ARGS, '--start-maximized'],
    defaultViewport: null,
  };
  if (site) {
    // Reuse the SHARED profile dir so the session the user earns here lands
    // directly in the worker's persistent profile (Cloudflare clearance tokens
    // are fingerprint-bound, so they must live in the same browser profile the
    // worker reuses). We only get here after the worker's lock is fully released.
    launchOptions.userDataDir = getProfileDir(site);
  }
  const browser = await _puppeteer.launch(launchOptions);
  const page = (await browser.pages())[0] || (await browser.newPage());
  if (site) {
    const key = String(site).toLowerCase();
    _interactiveSites.add(key);
    browser.once('disconnected', () => _interactiveSites.delete(key));
  }
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete navigator.__proto__.webdriver;
  });
  let navError = null;
  if (startUrl) {
    // A swallowed navigation failure leaves a blank window the user can't do
    // anything with — retry once, then report why the page never loaded.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        navError = null;
        break;
      } catch (err) {
        navError = err?.message || String(err);
        await delay(2000);
      }
    }
  }
  return { browser, page, navError };
}

/**
 * Make sure `page` carries a live authenticated session before an application
 * is submitted. The worker runs login() first, but sessions can silently lapse
 * between login and submit, and stored cookies can expire — instead of failing
 * the whole application, re-verify here and restore the session in place.
 * Order: existing session → cookie header → password login.
 * Returns 'session' | 'cookie' | 'password' when logged in, or false.
 */
async function ensureLoggedIn(page, { checkLoggedIn, cookie, cookieOrigin, passwordLogin } = {}) {
  if (typeof checkLoggedIn === 'function') {
    try {
      if (await checkLoggedIn(page)) return 'session';
    } catch { /* fall through to login attempts */ }
  }
  if (cookie && cookieOrigin) {
    const ok = await loginWithCookies(page, cookie, cookieOrigin, checkLoggedIn).catch(() => false);
    if (ok) return 'cookie';
  }
  if (typeof passwordLogin === 'function') {
    try {
      await passwordLogin(page);
      if (typeof checkLoggedIn !== 'function') return 'password';
      return (await checkLoggedIn(page)) ? 'password' : false;
    } catch { /* keep trying below */ }
  }
  return false;
}

/** Convert Puppeteer cookies into a raw "Cookie" request header string. */
function cookiesToHeader(cookies) {
  return (cookies || [])
    .filter((c) => c && c.name)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Navigate with rate-limit awareness. Wellfound and other Cloudflare-fronted
 * sites answer burst traffic with HTTP 429; Puppeteer's goto does NOT throw on
 * 4xx/5xx, so callers would scrape an error page and report misleading
 * failures ("cookie not accepted"). This waits out the throttle (honoring
 * Retry-After, bounded) and retries a couple of times with growing backoff.
 * Returns the final response (or null when navigation itself failed).
 */
async function gotoWithBackoff(page, url, { timeout = 40000, retries = 2, waitUntil = 'domcontentloaded' } = {}) {
  let waitMs = 20000;
  let resp = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    resp = await page.goto(url, { waitUntil, timeout }).catch(() => null);
    const status = resp ? resp.status() : 0;
    if (status !== 429 && status !== 403 && status !== 503) return resp;
    if (attempt === retries) break;
    const retryAfter = Number(resp?.headers?.()['retry-after']) || 0;
    waitMs = Math.min(Math.max(retryAfter * 1000, waitMs), 60000);
    console.warn(`[browser] HTTP ${status} from ${url} — backing off ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${retries})`);
    await delay(waitMs);
    waitMs *= 2;
  }
  return resp;
}

/** Human-readable error for a throttled/blocked response, or null when fine. */
function blockError(resp) {
  const status = resp ? resp.status() : 0;
  if (status === 429) return 'The site is rate limiting requests (HTTP 429) — wait a few minutes and retry.';
  if (status === 403 || status === 503) return 'The site blocked the request (bot protection) — use the Login via Browser button to restore the session.';
  return null;
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
  // With persistent profiles the browser may already hold a valid session —
  // injecting a stale cookie header over it could break it, so check first.
  if (typeof checkLoggedIn === 'function') {
    try {
      await page.goto(originUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await delay(1500);
      if (await checkLoggedIn(page)) return true;
    } catch (err) {
      if (err instanceof Error && /(auth page|login page|login form)/i.test(err.message)) {
        // fall through to cookie injection below
      }
    }
  }
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
    // Pick the RESUME file input, not just the first one on the page: prefer
    // inputs whose accept attribute allows documents, and never touch inputs
    // that look like avatar/photo uploads. Falls back to the first file input
    // when nothing better is available.
    const inputs = await page.$$('input[type="file"]');
    if (!inputs.length) return false;
    const idx = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('input[type="file"]'));
      const isDoc = (a) => /\.pdf|pdf|doc|resume|cv/i.test(a || '');
      const isImageOnly = (a) => /image|photo|avatar|picture/i.test(a || '');
      let pick = els.findIndex((el) => isDoc(el.getAttribute('accept')) && !isImageOnly(el.getAttribute('accept')));
      if (pick < 0) pick = els.findIndex((el) => !isImageOnly(el.getAttribute('accept')));
      return pick < 0 ? 0 : pick;
    }).catch(() => 0);
    const fileInput = inputs[Math.min(idx, inputs.length - 1)];
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

/**
 * Robust click: scroll the element into view, try Puppeteer's native click, and
 * fall back to an in-page `el.click()` if the native click reports the node as
 * not clickable (e.g. covered by an overlay or off-screen). Prevents the
 * "Node is either not clickable or not an Element" failures that otherwise
 * abort the whole apply job.
 */
async function safeClick(page, handle, label = 'button') {
  if (!handle) throw new Error('Missing ' + label + ' element to click');
  try {
    await handle.evaluate((el) => {
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', inline: 'center' });
    });
  } catch { /* ignore */ }
  await delay(250);

  // 1) Try Puppeteer's native click (real mouse event). If it fails ONLY because
  //    the element is "not clickable" (overlay/animation), fall back below.
  try {
    await handle.click({ timeout: 4000, delay: 80 });
    return true;
  } catch (nativeErr) {
    const msg = (nativeErr && nativeErr.message) || '';
    // A navigation that destroys the context means the click already worked.
    if (!/not clickable|is not visible|no node found|Node is detached/i.test(msg)) return true;

    // 2) Fallback: JS-native click, fired on a timer so any resulting navigation
    //    doesn't destroy the evaluate context (which would look like a failure).
    try {
      await handle.evaluate((el) => {
        if (!el) return;
        try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
        setTimeout(() => { try { el.click(); } catch (_) {} }, 0);
      });
      return true;
    } catch (jsErr) {
      throw new Error('Could not click ' + label + ': ' + (nativeErr?.message || nativeErr));
    }
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
    // submit redirects to a confirmation page). Flag it so confirmApplied can
    // treat a post-click navigation as a positive signal, distinct from a
    // genuine read failure (which stays unknown and defaults to NOT applied).
    return { readFailed: true, navigated: true };
  }
}

/**
 * Interpret `readApplyState` output: an apply button whose label switched to
 * "Applied"/"Submitted" (or disappeared, or is disabled) means the application
 * went through; a still-active "Apply"-labelled button means it didn't.
 * Unknown state defaults to NOT applied — for an apply tool, a false
 * "Applied" is worse than a false "not applied" (the user can verify and
 * retry, but a phantom application can't be undone).
 */
function confirmApplied(state) {
  if (!state || state.readFailed) {
    if (state?.navigated) {
      // Navigation right after the submit click is usually the confirmation
      // redirect — count it as applied, but mark it unconfirmed.
      return { applied: true, uncertain: true, reason: 'Page navigated after submit — likely a confirmation redirect, verify on the site.' };
    }
    return { applied: false, uncertain: true, reason: 'Application status could not be confirmed on the site — verify manually.' };
  }
  if (state.successText) return { applied: true };
  const stillApply = state.btnPresent && !state.btnDisabled
    && /apply|submit|register/.test(state.btnText)
    && !/applied|submitted|done/.test(state.btnText);
  if (stillApply) {
    // A still-active "Apply"-labelled button means the wizard never completed
    // (unfilled required fields, iframe-hosted form, silent rejection). Give
    // the worker a specific reason instead of a generic unconfirmed fallback.
    return { applied: false, reason: 'The apply button was still active after submitting — the application likely did not go through (form may be incomplete or hosted in an embedded frame).' };
  }
  return { applied: true };
}

module.exports = { getBrowser, getProfileDir, killProfileProcesses, newPage, withPage, safeText, safeAttr, delay, setCookiesFromHeader, loginWithCookies, closeBrowser, closeBrowserForSite, launchInteractiveBrowser, cookiesToHeader, gotoWithBackoff, blockError, uploadResumeFile, clickButtonByText, readApplyState, confirmApplied, safeClick, ensureLoggedIn };
