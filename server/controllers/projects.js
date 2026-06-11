const Project = require('../models/Project');
const { createCrudController } = require('./shared');

module.exports = createCrudController(Project, {
  allowedFields: [
    'name', 'role', 'description', 'location', 'startDate', 'endDate',
    'current', 'bullets', 'techStack', 'order', 'githubUrl', 'liveUrl', 'demoUrl', 'videoUrl',
  ],
  requiredFields: ['name'],
  stringFields: ['name', 'role', 'description', 'location', 'startDate', 'endDate', 'githubUrl', 'liveUrl', 'demoUrl', 'videoUrl'],
  arrayFields: {
    bullets: { maxItems: 50, maxLen: 1000 },
    techStack: { maxItems: 50, maxLen: 80 },
  },
  boolFields: ['current'],
  intFields: { order: { min: 0, max: 10000 } },
});
