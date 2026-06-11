const { CrudService } = require('../services/crudService');
const { createController } = require('./base');
const { str, int, strArray, bool } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');
const { AppError } = require('../middleware/errorHandler');

/**
 * Creates a controller for a model with string fields, optional arrays & booleans.
 */
function createCrudController(Model, config = {}) {
  const {
    allowedFields = [],
    requiredFields = [],
    stringFields = [],
    arrayFields = [],
    boolFields = [],
    intFields = [],
    sortField = 'order',
  } = config;

  class ModelService extends CrudService {
    constructor() {
      super(Model, { allowedFields, requiredFields });
    }

    _sanitize(data) {
      const out = super._sanitize(data);

      for (const f of stringFields) {
        if (out[f] !== undefined) {
          out[f] = cleanPlain(str({ [f]: out[f] }, f, { min: 1, max: f === 'description' ? 5000 : 500, optional: true }) || '');
        }
      }

      for (const [field, opts] of Object.entries(arrayFields)) {
        if (out[field] !== undefined) {
          out[field] = strArray({ [field]: out[field] }, field, { maxItems: opts.maxItems || 50, maxLen: opts.maxLen || 1000, optional: true });
        }
      }

      for (const f of boolFields) {
        if (out[f] !== undefined) {
          out[f] = bool({ [f]: out[f] }, f);
        }
      }

      for (const [field, opts] of Object.entries(intFields)) {
        if (out[field] !== undefined) {
          out[field] = int({ [field]: out[field] }, field, { min: opts.min || 0, max: opts.max || 10000, optional: true });
        }
      }

      return out;
    }
  }

  const service = new ModelService();
  return createController(service);
}

module.exports = { createCrudController };
