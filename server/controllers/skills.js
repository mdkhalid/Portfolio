const Skill = require('../models/Skill');
const { CrudService } = require('../services/crudService');
const { createController } = require('./base');
const { str, int } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');
const { AppError } = require('../middleware/errorHandler');

class SkillsService extends CrudService {
  constructor() {
    super(Skill, {
      allowedFields: ['category', 'items', 'order'],
      requiredFields: ['category'],
    });
  }

  _sanitize(data) {
    const out = super._sanitize(data);
    if (out.category !== undefined) {
      out.category = cleanPlain(str({ category: out.category }, 'category', { min: 1, max: 100, optional: true }) || '');
    }
    if (out.order !== undefined) {
      out.order = int({ order: out.order }, 'order', { min: 0, max: 10000 });
    }
    if (out.items !== undefined) {
      if (!Array.isArray(out.items)) throw new AppError('items must be an array', 400, 'INVALID_TYPE');
      if (out.items.length > 200) throw new AppError('items has too many entries', 400, 'TOO_MANY_ITEMS');
      out.items = out.items.map((it, idx) => {
        if (!it || typeof it !== 'object') throw new AppError(`items[${idx}] must be an object`, 400, 'INVALID_TYPE');
        const name = cleanPlain(str({ name: it.name }, 'name', { min: 1, max: 100, optional: true }) || '');
        if (!name) throw new AppError(`items[${idx}].name is required`, 400, 'MISSING_FIELDS');
        const level = it.level === undefined ? 50 : int({ level: it.level }, 'level', { min: 0, max: 100 });
        return { name, level };
      });
    }
    return out;
  }
}

const skillsService = new SkillsService();
module.exports = createController(skillsService);
