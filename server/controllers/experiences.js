const Experience = require('../models/Experience');
const { createCrudController } = require('./shared');

module.exports = createCrudController(Experience, {
  allowedFields: ['role', 'company', 'location', 'startDate', 'endDate', 'current', 'bullets', 'order'],
  requiredFields: ['role', 'company'],
  stringFields: ['role', 'company', 'location', 'startDate', 'endDate'],
  arrayFields: { bullets: { maxItems: 50, maxLen: 1000 } },
  boolFields: ['current'],
  intFields: { order: { min: 0, max: 10000 } },
});
