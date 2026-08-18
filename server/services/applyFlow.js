const ApplyFlow = require('../models/ApplyFlow');

/**
 * Load the persisted apply flow for a job site.
 * Falls back to null (callers keep using the adapter) when no flow is seeded.
 */
async function getApplyFlow(site) {
  if (!site) return null;
  const flow = await ApplyFlow.findOne({ site: String(site).toLowerCase() }).lean().catch(() => null);
  return flow || null;
}

/** Load all persisted flows (for the admin inspector). */
async function listApplyFlows() {
  return ApplyFlow.find().sort({ site: 1 }).lean().catch(() => []);
}

module.exports = { getApplyFlow, listApplyFlows };
