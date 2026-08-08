const crypto = require('crypto');

const KEY_ENV = 'JOB_CREDENTIALS_KEY';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const key = process.env[KEY_ENV];
  if (!key || key.length < 32) {
    throw new Error(
      `[credentials] ${KEY_ENV} must be set to a value >= 32 chars to encrypt job-site credentials.`
    );
  }
  // Derive a stable 32-byte key regardless of input length/format.
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a JSON-serializable value with AES-256-GCM.
 * Output format: <iv hex>:<authTag hex>:<ciphertext hex>
 */
function encrypt(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(plain), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt(). Returns the original value.
 */
function decrypt(token) {
  if (typeof token !== 'string' || !token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }
}

/** Mask a credential field for safe API responses (e.g. "moh****@gmail.com"). */
function maskValue(value) {
  if (typeof value !== 'string' || !value) return '';
  const v = value;
  if (v.length <= 4) return '*'.repeat(v.length);
  return v.slice(0, 3) + '*'.repeat(Math.min(v.length - 3, 8));
}

module.exports = { encrypt, decrypt, maskValue, ALGO };
