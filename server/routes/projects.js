const projCtrl = require('../controllers/projects');

// Thin route wrappers — business logic lives in controllers/projects.js
exports.getAll = projCtrl.getAll;
exports.create = projCtrl.create;
exports.update = projCtrl.update;
exports.remove = projCtrl.remove;
