const eduCtrl = require('../controllers/education');

// Thin route wrappers — business logic lives in controllers/education.js
exports.getAll = eduCtrl.getAll;
exports.create = eduCtrl.create;
exports.update = eduCtrl.update;
exports.remove = eduCtrl.remove;
