const UserSettings = require('../models/UserSettings');
const AiUsage = require('../models/AiUsage');

/**
 * AI cost guard — tracks AI generation spend against the user's configurable
 * daily/weekly budget (UserSettings.aiDailyBudget / aiWeeklyBudget).
 */

// Lazy require to avoid any module-cycle risk at import time.
let _notify = null;
const getNotify = () => {
  if (!_notify) _notify = require('./notifications').notify;
  return _notify;
};

/** Get or create settings for a user. */
async function getSettings(userId) {
  let settings = await UserSettings.findOne({ userId }).lean();
  if (!settings) {
    settings = await UserSettings.create({ userId });
  }
  return settings;
}

function buckets(date = new Date()) {
  const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = startOfDay.toISOString().slice(0, 10);
  const dow = startOfDay.getUTCDay() || 7; // Sunday -> 7, Monday -> 1
  const startOfWeek = new Date(startOfDay.getTime() - (dow - 1) * 86400000);
  const week = startOfWeek.toISOString().slice(0, 10);
  return { day, week };
}

/** Count AI generations in the current UTC day/week. */
async function getUsage(userId, date = new Date()) {
  const { day, week } = buckets(date);
  const [daily, weekly] = await Promise.all([
    AiUsage.countDocuments({ userId, day }),
    AiUsage.countDocuments({ userId, week }),
  ]);
  return { daily, weekly, day, week };
}

/**
 * Check whether an AI generation is within budget.
 * Returns { allowed: true } or { allowed: false, reason, daily, weekly }.
 */
async function checkAICost(userId, { date = new Date() } = {}) {
  const settings = await getSettings(userId);
  const dailyCap = Number(settings.aiDailyBudget) || 100;
  const weeklyCap = Number(settings.aiWeeklyBudget) || 500;

  if (dailyCap <= 0 && weeklyCap <= 0) return { allowed: true };

  const { daily, weekly, day, week } = await getUsage(userId, date);
  if (weeklyCap > 0 && weekly >= weeklyCap) {
    getNotify()({
      userId,
      type: 'ai_budget',
      title: 'AI budget reached',
      body: `Weekly AI budget reached (${weekly}/${weeklyCap} generations). AI steps paused until the next budget window.`,
      dedupeKey: `ai-budget-${userId}-week-${week}`,
    }).catch(() => {});
    return {
      allowed: false,
      reason: `Weekly AI budget reached (${weekly}/${weeklyCap} generations). Paused AI steps until the next budget window.`,
      daily, weekly, day, week,
    };
  }
  if (dailyCap > 0 && daily >= dailyCap) {
    getNotify()({
      userId,
      type: 'ai_budget',
      title: 'AI budget reached',
      body: `Daily AI budget reached (${daily}/${dailyCap} generations). AI steps paused until tomorrow.`,
      dedupeKey: `ai-budget-${userId}-day-${day}`,
    }).catch(() => {});
    return {
      allowed: false,
      reason: `Daily AI budget reached (${daily}/${dailyCap} generations). Paused AI steps until tomorrow.`,
      daily, weekly, day, week,
    };
  }
  return { allowed: true, daily, weekly, day, week };
}

/** Record one AI generation against the current day/week buckets. */
async function recordAICost({ userId, purpose, jobId = null, date = new Date() } = {}) {
  const { day, week } = buckets(date);
  const doc = await AiUsage.create({ userId, purpose, jobId, day, week });
  return { id: doc._id, day, week };
}

module.exports = { getSettings, getUsage, checkAICost, recordAICost };
