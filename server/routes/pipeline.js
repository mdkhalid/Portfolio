const express = require('express');
const UserSettings = require('../models/UserSettings');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { int } = require('../middleware/validate');
const { checkAICost, getUsage } = require('../services/aiCost');

const router = express.Router();

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
  });
}));

/** POST /api/pipeline/pause — master kill-switch: stop accepting new applications. */
router.post('/pause', asyncHandler(async (req, res) => {
  await UserSettings.updateOne(
    { userId: req.adminId },
    { $set: { pipelinePaused: true } },
    { upsert: true }
  );
  res.json({ paused: true, message: 'Pipeline paused. No new applications will be queued.' });
}));

/** POST /api/pipeline/resume — re-enable the pipeline. */
router.post('/resume', asyncHandler(async (req, res) => {
  await UserSettings.updateOne(
    { userId: req.adminId },
    { $set: { pipelinePaused: false } },
    { upsert: true }
  );
  res.json({ paused: false, message: 'Pipeline resumed. New applications will be accepted.' });
}));

/** PUT /api/pipeline/budget — configure AI cost guard + pipeline tuning. */
router.put('/budget', asyncHandler(async (req, res) => {
  const aiDailyBudget = int(req.body, 'aiDailyBudget', { min: 0, max: 100000, optional: true });
  const aiWeeklyBudget = int(req.body, 'aiWeeklyBudget', { min: 0, max: 1000000, optional: true });
  const maxApplyPerBatch = int(req.body, 'maxApplyPerBatch', { min: 1, max: 500, optional: true });
  const applyRateDelayMs = int(req.body, 'applyRateDelayMs', { min: 0, max: 3600000, optional: true });
  const siteConcurrency = int(req.body, 'siteConcurrency', { min: 1, max: 5, optional: true });

  const patch = {};
  if (aiDailyBudget !== undefined) patch.aiDailyBudget = aiDailyBudget;
  if (aiWeeklyBudget !== undefined) patch.aiWeeklyBudget = aiWeeklyBudget;
  if (maxApplyPerBatch !== undefined) patch.maxApplyPerBatch = maxApplyPerBatch;
  if (applyRateDelayMs !== undefined) patch.applyRateDelayMs = applyRateDelayMs;
  if (siteConcurrency !== undefined) patch.siteConcurrency = siteConcurrency;

  if (!Object.keys(patch).length) throw new AppError('Nothing to update', 400, 'NOTHING_TO_UPDATE');

  await UserSettings.updateOne({ userId: req.adminId }, { $set: patch }, { upsert: true });
  res.json({ message: 'Settings updated', ...patch });
}));

module.exports = router;
