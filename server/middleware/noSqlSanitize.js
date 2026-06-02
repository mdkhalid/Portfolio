const DANGEROUS_KEYS = /^\$|\./;

const sanitizeKeys = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) obj[i] = sanitizeKeys(obj[i]);
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.test(key)) {
      console.warn(`[noSqlSanitize] Removed key "${key}" in request`);
      delete obj[key];
      continue;
    }
    obj[key] = sanitizeKeys(obj[key]);
  }
  return obj;
};

const noSqlSanitize = (req, res, next) => {
  if (req.body) sanitizeKeys(req.body);
  if (req.params) sanitizeKeys(req.params);
  next();
};

module.exports = { noSqlSanitize, sanitizeKeys };
