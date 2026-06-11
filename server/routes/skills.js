const skillsCtrl = require('../controllers/skills');

// Thin route wrappers — business logic lives in controllers/skills.js
exports.getAll = skillsCtrl.getAll;
exports.create = skillsCtrl.create;
exports.update = skillsCtrl.update;
exports.remove = skillsCtrl.remove;
