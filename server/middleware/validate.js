const validator = require('validator');
const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

const MAX_STR = 5000;
const MAX_SHORT = 200;
const MAX_LONG = 50000;

const isString = (v) => typeof v === 'string';
const isNonEmptyString = (v) => isString(v) && v.trim().length > 0;
const trim = (v) => (isString(v) ? v.trim() : v);

const requireFields = (body, fields) => {
  const missing = fields.filter((f) => !isNonEmptyString(body?.[f]));
  if (missing.length) {
    throw new AppError(`Missing required field(s): ${missing.join(', ')}`, 400, 'MISSING_FIELDS');
  }
};

const str = (body, key, { min = 1, max = MAX_STR, optional = false } = {}) => {
  const v = body?.[key];
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw new AppError(`Field "${key}" is required`, 400, 'MISSING_FIELDS');
  }
  if (!isString(v)) {
    throw new AppError(`Field "${key}" must be a string`, 400, 'INVALID_TYPE');
  }
  const t = v.trim();
  if (t.length < min) {
    throw new AppError(`Field "${key}" must be at least ${min} character(s)`, 400, 'TOO_SHORT');
  }
  if (t.length > max) {
    throw new AppError(`Field "${key}" must be at most ${max} characters`, 400, 'TOO_LONG');
  }
  return t;
};

const email = (body, key, { optional = false } = {}) => {
  const v = str(body, key, { min: 3, max: 254, optional });
  if (v === undefined) return undefined;
  if (!validator.isEmail(v)) {
    throw new AppError(`Field "${key}" must be a valid email`, 400, 'INVALID_EMAIL');
  }
  return validator.normalizeEmail(v);
};

const int = (body, key, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) => {
  const v = body?.[key];
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw new AppError(`Field "${key}" is required`, 400, 'MISSING_FIELDS');
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isInteger(n)) {
    throw new AppError(`Field "${key}" must be an integer`, 400, 'INVALID_TYPE');
  }
  if (n < min || n > max) {
    throw new AppError(`Field "${key}" must be between ${min} and ${max}`, 400, 'OUT_OF_RANGE');
  }
  return n;
};

const bool = (body, key, { optional = false } = {}) => {
  const v = body?.[key];
  if (v === undefined || v === null) {
    if (optional) return undefined;
    throw new AppError(`Field "${key}" is required`, 400, 'MISSING_FIELDS');
  }
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  throw new AppError(`Field "${key}" must be a boolean`, 400, 'INVALID_TYPE');
};

const mongoId = (val, name = 'id') => {
  if (!isString(val) || !mongoose.Types.ObjectId.isValid(val)) {
    throw new AppError(`Invalid ${name}`, 400, 'INVALID_ID');
  }
  return val;
};

const strArray = (body, key, { maxItems = 100, maxLen = 200, optional = false } = {}) => {
  const v = body?.[key];
  if (v === undefined || v === null) {
    if (optional) return [];
    throw new AppError(`Field "${key}" is required`, 400, 'MISSING_FIELDS');
  }
  let arr = v;
  if (isString(v)) {
    if (!v.trim()) return optional ? [] : (() => { throw new AppError(`Field "${key}" is required`, 400, 'MISSING_FIELDS'); })();
    arr = v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(arr)) {
    throw new AppError(`Field "${key}" must be an array`, 400, 'INVALID_TYPE');
  }
  if (arr.length > maxItems) {
    throw new AppError(`Field "${key}" has too many items (max ${maxItems})`, 400, 'TOO_MANY_ITEMS');
  }
  return arr.map((item) => {
    if (!isString(item)) {
      throw new AppError(`Field "${key}" must contain only strings`, 400, 'INVALID_TYPE');
    }
    const t = item.trim();
    if (t.length > maxLen) {
      throw new AppError(`Field "${key}" item too long (max ${maxLen} chars)`, 400, 'TOO_LONG');
    }
    return t;
  });
};

const pick = (obj, allowed) => {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allowed.includes(k)) out[k] = obj[k];
  }
  return out;
};

const LIMIT_PRESETS = {
  SHORT: MAX_SHORT,
  STR: MAX_STR,
  LONG: MAX_LONG,
};

module.exports = {
  str,
  email,
  int,
  bool,
  strArray,
  mongoId,
  pick,
  requireFields,
  trim,
  isString,
  isNonEmptyString,
  LIMIT_PRESETS,
};
