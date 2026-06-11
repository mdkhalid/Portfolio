const certCtrl = require('../controllers/certifications');

// Thin route wrappers — business logic lives in controllers/certifications.js
exports.getAll = certCtrl.getAll;
exports.create = certCtrl.create;
exports.update = certCtrl.update;
exports.remove = certCtrl.remove;
