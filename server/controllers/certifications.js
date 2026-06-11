const Certification = require('../models/Certification');
const { createCrudController } = require('./shared');

module.exports = createCrudController(Certification, {
  allowedFields: ['name', 'issuer', 'date', 'link', 'order'],
  requiredFields: ['name'],
  stringFields: ['name', 'issuer', 'date', 'link'],
  intFields: { order: { min: 0, max: 10000 } },
});
