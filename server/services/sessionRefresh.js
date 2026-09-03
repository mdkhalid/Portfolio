const UserJobSite = require('../models/UserJobSite');
const { encrypt, decrypt } = require('../utils/credentials');
const { withPage, setCookiesFromHeader, delay, cookiesToHeader } = require('../adapters/browser');
const { SITE_META } = require('../adapters');
const { detectLoggedIn, cookiesForSite } = require('./browserLogin');

/**
 * Sliding session keep-alive for job sites.
 *
 * Sites rotate session tokens — a cookie snapshot taken at login time goes
 * stale after a few days. This replays the stored session against the site,
 * and if it still authenticates, captures the FRESH cookie jar (sites reissue
 * rolling tokens on every visit) and stores it back. Called after every
 * successful submit, so the session stays valid indefinitely as long as the
 * pipeline keeps using it.
 */
async function refreshSiteCookies(userId, site) {
  try {
    const doc = await UserJobSite.findOne({ userId, name: site }).select('+cookies');
    if (!doc || !doc.cookies) return;
    const cookieHeader = decrypt(doc.cookies)?.value;
    if (!cookieHeader) return;
    const origin = (SITE_META[site] || {}).homeUrl || doc.baseUrl;
    if (!origin) return;

    const fresh = await withPage(async (page) => {
      const set = await setCookiesFromHeader(page, cookieHeader, origin);
      if (!set) return null;
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await delay(2500);
      // Only persist a fresh set when the session is CONFIRMED alive — never
      // overwrite good cookies with a logged-out jar.
      if (!(await detectLoggedIn(page, site))) return null;
      const cookies = cookiesForSite(await page.cookies().catch(() => []), site);
      return cookies.length ? cookiesToHeader(cookies) : null;
    });
    if (fresh) {
      doc.cookies = encrypt({ value: fresh });
      doc.cookieUpdatedAt = new Date();
      await doc.save();
      return;
    }

    // The stored session no longer authenticates. Previously this returned
    // silently, so the user only found out when an application failed at
    // submit time (e.g. "Indeed session cookie is invalid or expired").
    // Surface it now: flag the site and notify once (deduped) so the user
    // reconnects BEFORE the next auto-apply run.
    if (doc.status === 'connected') {
      doc.status = 'error';
      await doc.save().catch(() => {});
    }
    const { notify } = require('./notifications');
    await notify({
      userId,
      type: 'system',
      title: `${site} session expired`,
      body: `Your saved ${site} login no longer works — use the Login via Browser button in the Job Sites tab to reconnect before the next auto-apply run.`,
      metadata: { site },
      dedupeKey: `${site}-session-expired`,
      maxAgeMs: 24 * 60 * 60 * 1000,
    }).catch(() => {});
  } catch (err) {
    // Best-effort: a failed refresh must never break the apply flow.
    console.error('[sessionRefresh] cookie refresh failed for', site, ':', err?.message || err);
  }
}

/**
 * Capture the session cookies that a just-succeeded PASSWORD login created in
 * the shared browser context and persist them. Turns a one-off password login
 * into a reusable, refreshable cookie session (no re-login needed next run).
 *
 * Only persists when the context is CONFIRMED logged in — a failed login
 * (CAPTCHA/bot wall) leaves a logged-out jar, and saving it would destroy a
 * previously-working stored session.
 */
async function captureCookiesFromContext(userId, site) {
  try {
    const doc = await UserJobSite.findOne({ userId, name: site }).select('+cookies');
    if (!doc) return;
    const origin = (SITE_META[site] || {}).homeUrl || doc.baseUrl;
    if (!origin) return;
    const header = await withPage(async (page) => {
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await delay(1500);
      if (!(await detectLoggedIn(page, site))) return null;
      const cookies = await page.cookies(origin).catch(() => []);
      const relevant = cookiesForSite(cookies, site);
      return relevant.length ? cookiesToHeader(relevant) : null;
    }, site);
    if (!header) return;

    doc.cookies = encrypt({ value: header });
    doc.cookieUpdatedAt = new Date();
    await doc.save();
  } catch (err) {
    console.error('[sessionRefresh] cookie capture failed for', site, ':', err?.message || err);
  }
}

module.exports = { refreshSiteCookies, captureCookiesFromContext };
