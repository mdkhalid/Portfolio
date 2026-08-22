const crypto = require('crypto');

// AES-256-GCM encryption for social OAuth tokens (LinkedIn / X).
// Mirrors utils/credentials.js but keyed by SOCIAL_CREDENTIALS_KEY so rotating
// one key never impacts the other subsystem.

const KEY_ENV = 'SOCIAL_CREDENTIALS_KEY';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const key = process.env[KEY_ENV];
  if (!key || key.length < 32) {
    throw new Error(
      `[cryptoSocial] ${KEY_ENV} must be set to a value >= 32 chars to encrypt social tokens.`
    );
  }
  // Derive a stable 32-byte key regardless of input length/format.
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string (OAuth token). Output format: <iv hex>:<authTag hex>:<ciphertext hex>
 */
function encryptToken(plain) {
  if (typeof plain !== 'string' || !plain) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt a token produced by encryptToken(). Returns the original string,
 * or null when the input is malformed/tampered or the key has changed.
 */
function decryptToken(payload) {
  if (typeof payload !== 'string' || !payload) return null;
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encryptToken, decryptToken, ALGO };
