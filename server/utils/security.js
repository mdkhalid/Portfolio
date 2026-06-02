const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const PROMPT_INJECTION_PATTERNS = [
  /ignore (the )?(previous|above|prior) (instructions?|prompts?)/i,
  /disregard (the )?(previous|above|prior) (instructions?|prompts?)/i,
  /forget (everything|all) (above|before)/i,
  /you are now/i,
  /act as (a )?(?!resume)/i,
  /system\s*:/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /reveal (your|the) (system )?prompt/i,
  /show (me )?(your|the) (system|initial) (prompt|instructions)/i,
  /developer mode/i,
  /jailbreak/i,
  /pretend (you|to be)/i,
];

const sanitizeForAI = (input) => {
  if (typeof input !== 'string') return '';
  let cleaned = input.replace(/[\u0000-\u001f\u007f]/g, '');
  for (const re of PROMPT_INJECTION_PATTERNS) {
    if (re.test(cleaned)) {
      throw new AppError('Message contains disallowed content', 400, 'INVALID_INPUT');
    }
  }
  if (cleaned.length > 2000) {
    cleaned = cleaned.slice(0, 2000);
  }
  return cleaned.trim();
};

const sha256 = (input) =>
  crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 32);

const isPathSafe = (filename) => {
  if (typeof filename !== 'string') return false;
  if (filename.length === 0 || filename.length > 255) return false;
  if (filename.includes('\0')) return false;
  if (filename.includes('/') || filename.includes('\\')) return false;
  if (filename === '.' || filename === '..') return false;
  if (/^\.+$/.test(filename)) return false;
  return /^[A-Za-z0-9._-]+$/.test(filename);
};

const redactEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '[redacted]';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[redacted]';
  const masked = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
};

const envInt = (name, def) => {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return def;
  return n;
};

module.exports = {
  sanitizeForAI,
  sha256,
  isPathSafe,
  redactEmail,
  envInt,
};
