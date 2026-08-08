const env = require('../config/env');
const Job = require('../models/Job');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const { fetchFromSite } = require('../routes/jobs');

let _timer = null;

/**
 * Daily scheduled refresh: re-runs the job fetch for every user with enabled
 * sites, and marks stale jobs as expired based on each user's settings.
 * (Runs once shortly after boot too, so devs see results without waiting.)
 */
async function runScheduledFetch() {
  const entries = await UserJobSite.find({ enabled: true }).lean();
  const byUser = {};
  for (const e of entries) {
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e.name);
  }
  for (const [userId, sites] of Object.entries(byUser)) {
    for (const site of sites) {
      await fetchFromSite({ userId, site, pageCount: 1, maxJobs: 50 }).catch((err) =>
        console.error('[scheduler] fetch failed', userId, site, err.message)
      );
    }
  }
}

async function runStaleExpiry() {
  const settings = await UserSettings.find().lean();
  const defaultDays = Number(env.JOB_STALE_DAYS) || 7;
  for (const s of settings) {
    const days = s.expireAfterDays || defaultDays;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await Job.updateMany(
      { userId: s.userId, status: 'new', lastSeenAt: { $lt: cutoff } },
      { $set: { status: 'expired' } }
    );
  }
}

async function tick() {
  await runStaleExpiry().catch(() => {});
  await runScheduledFetch().catch(() => {});
}

/** Start the daily scheduler; also runs one tick shortly after boot. */
function startScheduler() {
  if (_timer) return _timer;
  _timer = setInterval(tick, 24 * 60 * 60 * 1000);
  _timer.unref();
  setTimeout(tick, 5000).unref();
  console.log(
    `[scheduler] job fetch + stale expiry scheduled daily (cron "${env.JOB_FETCH_SCHEDULE}" documented)`
  );
  return _timer;
}

function stopScheduler() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { startScheduler, stopScheduler, runStaleExpiry, runScheduledFetch, tick };
