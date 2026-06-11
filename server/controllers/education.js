const Education = require('../models/Education');
const { createCrudController } = require('./shared');

module.exports = createCrudController(Education, {
  allowedFields: ['degree', 'field', 'institution', 'location', 'startDate', 'endDate', 'order'],
  requiredFields: ['degree', 'institution'],
  stringFields: ['degree', 'field', 'institution', 'location', 'startDate', 'endDate'],
  intFields: { order: { min: 0, max: 10000 } },
});
