const profileCtrl = require('../controllers/profile');

// Thin route wrappers — business logic lives in controllers/profile.js
// (same pattern as skills/experiences/education/certifications/projects).
// Singleton resource: custom getAll/update, not createCrudController.
exports.getAll = profileCtrl.getAll;
exports.update = profileCtrl.update;
