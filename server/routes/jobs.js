// Barrel: split per concern (Phase 3.1). server.js keeps requiring './routes/jobs'.
// - jobs.list.js: list, update, manual* (CRUD + manual apply)
// - jobs.match.js: fetch, match (search + AI scoring)
// - jobs.apply.js: apply, cancelBatch, cancelApplication, retryApplication, submitApplicationAnswers
// - jobs.pipeline.js: getBatchProgress, getApplicationProgress, active/list/update Applications
// Shared models/helpers live in jobs.common.js.
module.exports = {
  ...require('./jobs.list'),
  ...require('./jobs.match'),
  ...require('./jobs.apply'),
  ...require('./jobs.pipeline'),
  getSearchKeywords: require('./jobs.common').getSearchKeywords,
  fetchFromSite: require('./jobs.common').fetchFromSite,
};
