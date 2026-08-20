const env = require('../config/env');
const Job = require('../models/Job');
const UserJobSite = require('../models/UserJobSite');
const UserSettings = require('../models/UserSettings');
const { fetchFromSite } = require('../routes/jobs');

let _timer = null;
let _digestTimer = null;

/**
 * Resolve the job-fetch schedule. Accepts a standard 5-field cron expression
 * (e.g. "0 9 * * *") via JOB_FETCH_SCHEDULE. Falls back to a fixed 24h interval
 * for legacy/unparseable values so the pipeline still runs.
 */
function getFetchSchedule() {
  const raw = String(env.JOB_FETCH_SCHEDULE || '').trim();
  if (raw && /^(\S+\s+){4}\S+$/.test(raw)) return { type: 'cron', expr: raw };
  return { type: 'interval', ms: 24 * 60 * 60 * 1000 };
}

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
  const { emitJobsChanged } = require('../services/notifications');
  for (const s of settings) {
    const days = s.expireAfterDays || defaultDays;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const res = await Job.updateMany(
      { userId: s.userId, status: 'new', lastSeenAt: { $lt: cutoff } },
      { $set: { status: 'expired' } }
    );
    if (res.modifiedCount) emitJobsChanged(s.userId);
  }
}

async function tick() {
  await runStaleExpiry().catch(() => {});
  await runScheduledFetch().catch(() => {});
  // Phase 1: Proactive session health-check — refresh cookies for all
  // enabled + connected sites at intervals shorter than the cookie TTL,
  // preventing silent session expiration between auto-apply runs.
  try {
    const { refreshSiteCookies } = require('../services/sessionRefresh');
    const entries = await UserJobSite.find({ enabled: true, status: 'connected' }).lean();
    for (const e of entries) {
      await refreshSiteCookies(e.userId, e.name).catch(() => {});
    }
  } catch (err) {
    console.error('[scheduler] session health-check failed:', err?.message || err);
  }
  const { sendDailyDigests } = require('../services/notifications');
  await sendDailyDigests().catch(() => {});
}

/** Start the daily scheduler; also runs one tick shortly after boot. */
function startScheduler() {
  if (_timer) return _timer;

  const schedule = getFetchSchedule();
  if (schedule.type === 'cron') {
    let cron = null;
    try {
      cron = require('node-cron');
    } catch {
      console.warn('[scheduler] node-cron unavailable — falling back to 24h interval');
    }
    if (cron && cron.validate(schedule.expr)) {
      _timer = cron.schedule(schedule.expr, () => {
        tick().catch((err) => console.error('[scheduler] tick failed:', err?.message || err));
      });
    } else {
      _timer = setInterval(tick, 24 * 60 * 60 * 1000);
      _timer.unref();
    }
  } else {
    _timer = setInterval(tick, schedule.ms);
    _timer.unref();
  }

  // Email digests go out a few times a day so users aren't waiting a full 24h.
  _digestTimer = setInterval(() => {
    const { sendDailyDigests } = require('../services/notifications');
    sendDailyDigests().catch(() => {});
  }, 6 * 60 * 60 * 1000);
  _digestTimer.unref();
  setTimeout(tick, 5000).unref();
  console.log(
    `[scheduler] job fetch scheduled: ${schedule.type === 'cron' ? `cron "${schedule.expr}"` : `${Math.round(schedule.ms / 60000)}m interval`}`
  );
  return _timer;
}

function stopScheduler() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (_digestTimer) {
    clearInterval(_digestTimer);
    _digestTimer = null;
  }
}

module.exports = { startScheduler, stopScheduler, runStaleExpiry, runScheduledFetch, tick, getFetchSchedule };
