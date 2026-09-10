/**
 * Well-known placeholder / weak secret detection.
 *
 * Used by config/env.js to fail fast at startup when a secret (JWT_SECRET,
 * JWT_SECRET_PREVIOUS) is a copy-pasted example value, an obvious guess, or
 * too short to be safe. Pure module — no env or dotenv access — so it can be
 * unit-tested directly.
 */

const WEAK_SECRET_VALUES = [
  'change_me_to_a_random_32_character_string',
  'your_jwt_secret_here',
  'generate_a_random_secret_that_is_at_least_32_chars_long',
  'changeme',
  'change-me',
  'change_me',
  'placeholder',
  'replace_me',
  'replace_this',
  'your_secret_here',
  'your-secret-here',
  'secret',
  'secrets',
  'password',
  'password123',
  '12345678',
  '1234567890123456789012345678901234567890',
  'test-secret-that-is-at-least-32-chars-long!!',
  'jwt_secret',
  'jwtsecret',
  'supersecret',
  'super-secret',
  'mysecret',
  'my-secret',
  'default',
  'example',
  'dummy',
  'sample',
  'todo',
  'fixme',
  'xxx',
  'abc123',
  'qwerty',
  'letmein',
  'admin',
  'admin123',
  'secretkey',
  'secret-key',
  'secret_key',
  'development',
  'production',
];

const WEAK_SECRET_SUBSTRINGS = [
  'generate_a_random_secret',
  'change_me',
  'your_jwt',
  'your_secret',
  'replace_me',
  'placeholder',
  'changeme',
  'example_secret',
];

const MIN_SECRET_LENGTH = 32;

/**
 * True when the value is missing, too short (<32 chars), an exact
 * well-known weak value, or contains a placeholder fragment. Comparison is
 * case-insensitive.
 */
function isWeakSecret(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  if (v.length < MIN_SECRET_LENGTH) return true;
  if (WEAK_SECRET_VALUES.includes(v)) return true;
  return WEAK_SECRET_SUBSTRINGS.some((frag) => v.includes(frag));
}

module.exports = { isWeakSecret, MIN_SECRET_LENGTH, WEAK_SECRET_VALUES, WEAK_SECRET_SUBSTRINGS };
