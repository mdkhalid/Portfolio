const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:the\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)/i,
  /disregard\s+(?:the\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)/i,
  /forget\s+(?:everything|all)\s+(?:above|before)/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\s+(?:a\s+)?(?!resume)/i,
  /\bsystem\s*:\s*/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /reveal\s+(?:your|the)\s+(?:system\s+)?prompt/i,
  /show\s+(?:me\s+)?(?:your|the)\s+(?:system|initial)\s+(?:prompt|instructions)/i,
  /\bdeveloper\s+mode\b/i,
  /\bjailbreak\b/i,
  /\bpretend\s+(?:you|to\s+be)\b/i,
  /\boverride\s+(?:the\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)/i,
  /\bskip\s+(?:the\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)/i,
  /\bnew\s+(?:instructions?|prompts?|rules?)\b/i,
  /\bdo\s+not\s+(?:follow|obey)\s+(?:the\s+)?(?:previous|above|prior)/i,
  /role\s*:\s*(?:system|assistant|developer)/i,
];

const OBFUSCATION_PATTERNS = [
  /&#x?[0-9a-f]+;/i,
  /\\u[0-9a-f]{4}/i,
  /\\x[0-9a-f]{2}/i,
  /%[0-9a-f]{2}/i,
  /String\.fromCharCode/i,
  /\.concat\(/i,
  /\+.*\+/,
];

function normalizeInput(input) {
  let normalized = input.replace(/[\u0000-\u001f\u007f]/g, '');
  normalized = normalized.replace(/&#x?([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  normalized = normalized.replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  normalized = normalized.replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  normalized = normalized.replace(/%([0-9a-f]{2})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return normalized.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasObfuscation(input) {
  return OBFUSCATION_PATTERNS.some((re) => re.test(input));
}

const sanitizeForAI = (input) => {
  if (typeof input !== 'string') return '';

  const normalized = normalizeInput(input);

  if (hasObfuscation(input)) {
    throw new AppError('Message contains disallowed content', 400, 'INVALID_INPUT');
  }

  for (const re of PROMPT_INJECTION_PATTERNS) {
    if (re.test(normalized)) {
      throw new AppError('Message contains disallowed content', 400, 'INVALID_INPUT');
    }
  }

  if (input.length > 2000) {
    input = input.slice(0, 2000);
  }
  return input.trim();
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
