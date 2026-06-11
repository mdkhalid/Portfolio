const expCtrl = require('../controllers/experiences');

// Thin route wrappers — business logic lives in controllers/experiences.js
exports.getAll = expCtrl.getAll;
exports.create = expCtrl.create;
exports.update = expCtrl.update;
exports.remove = expCtrl.remove;
