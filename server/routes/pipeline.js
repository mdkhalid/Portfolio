const express = require('express');
const UserSettings = require('../models/UserSettings');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { int, bool } = require('../middleware/validate');
const { checkAICost, getUsage } = require('../services/aiCost');
const { notify } = require('../services/notifications');

const router = express.Router();

const DIGESTS = ['none', 'instant', 'daily'];

/** GET /api/pipeline/status — current pipeline + budget status. */
router.get('/status', asyncHandler(async (req, res) => {
  let settings = await UserSettings.findOne({ userId: req.adminId }).lean();
  if (!settings) {
    settings = await UserSettings.create({ userId: req.adminId });
    settings = settings.toObject();
  }
  const usage = await getUsage(req.adminId);
  res.json({
    paused: settings.pipelinePaused,
    aiDailyBudget: settings.aiDailyBudget,
    aiWeeklyBudget: settings.aiWeeklyBudget,
    aiDailyUsage: usage.daily,
    aiWeeklyUsage: usage.weekly,
    maxApplyPerBatch: settings.maxApplyPerBatch,
    applyRateDelayMs: settings.applyRateDelayMs,
    siteConcurrency: settings.siteConcurrency,
    notifyEmail: settings.notifyEmail,
    notifyDigest: settings.notifyDigest,
  });
}));

/** POST /api/pipeline/pause — master kill-switch: stop accepting new applications. */
router.post('/pause', asyncHandler(async (req, res) => {
  await UserSettings.updateOne(
    { userId: req.adminId },
    { $set: { pipelinePaused: true } },
    { upsert: true }
  );
  notify({
    userId: req.adminId,
    type: 'pipeline_paused',
    title: 'Apply pipeline paused',
    body: 'No new applications will be queued until you resume.',
  }).catch(() => {});
  res.json({ paused: true, message: 'Pipeline paused. No new applications will be queued.' });
}));

/** POST /api/pipeline/resume — re-enable the pipeline. */
router.post('/resume', asyncHandler(async (req, res) => {
  await UserSettings.updateOne(
    { userId: req.adminId },
    { $set: { pipelinePaused: false } },
    { upsert: true }
  );
  notify({
    userId: req.adminId,
    type: 'pipeline_resumed',
    title: 'Apply pipeline resumed',
    body: 'New applications will be accepted again.',
  }).catch(() => {});
  res.json({ paused: false, message: 'Pipeline resumed. New applications will be accepted.' });
}));

/** PUT /api/pipeline/budget — configure AI cost guard + pipeline tuning. */
router.put('/budget', asyncHandler(async (req, res) => {
  const aiDailyBudget = int(req.body, 'aiDailyBudget', { min: 0, max: 100000, optional: true });
  const aiWeeklyBudget = int(req.body, 'aiWeeklyBudget', { min: 0, max: 1000000, optional: true });
  const maxApplyPerBatch = int(req.body, 'maxApplyPerBatch', { min: 1, max: 500, optional: true });
  const applyRateDelayMs = int(req.body, 'applyRateDelayMs', { min: 0, max: 3600000, optional: true });
  const siteConcurrency = int(req.body, 'siteConcurrency', { min: 1, max: 5, optional: true });
  const notifyEmail = bool(req.body, 'notifyEmail', { optional: true });
  const notifyDigestRaw = req.body?.notifyDigest;
  const notifyDigest =
    notifyDigestRaw !== undefined && notifyDigestRaw !== ''
      ? (DIGESTS.includes(notifyDigestRaw) ? notifyDigestRaw : (() => { throw new AppError('notifyDigest must be one of: none, instant, daily', 400, 'INVALID_TYPE'); })())
      : undefined;

  const patch = {};
  if (aiDailyBudget !== undefined) patch.aiDailyBudget = aiDailyBudget;
  if (aiWeeklyBudget !== undefined) patch.aiWeeklyBudget = aiWeeklyBudget;
  if (maxApplyPerBatch !== undefined) patch.maxApplyPerBatch = maxApplyPerBatch;
  if (applyRateDelayMs !== undefined) patch.applyRateDelayMs = applyRateDelayMs;
  if (siteConcurrency !== undefined) patch.siteConcurrency = siteConcurrency;
  if (notifyEmail !== undefined) patch.notifyEmail = notifyEmail;
  if (notifyDigest !== undefined) patch.notifyDigest = notifyDigest;

  if (!Object.keys(patch).length) throw new AppError('Nothing to update', 400, 'NOTHING_TO_UPDATE');

  await UserSettings.updateOne({ userId: req.adminId }, { $set: patch }, { upsert: true });
  res.json({ message: 'Settings updated', ...patch });
}));

module.exports = router;
