/**
 * Unit tests for config/weakSecret.js (Phase 4.2) and the PII log scrubber
 * in middleware/errorHandler.js (Phase 4.6).
 */
const { isWeakSecret, MIN_SECRET_LENGTH, WEAK_SECRET_VALUES, WEAK_SECRET_SUBSTRINGS } = require('../config/weakSecret');
const { __testables } = require('../middleware/errorHandler');

const { scrubForLog } = __testables;

const STRONG = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

describe('isWeakSecret (config/weakSecret.js)', () => {
  it('accepts a strong random 32+ char secret', () => {
    expect(isWeakSecret(STRONG)).toBe(false);
    expect(isWeakSecret('THIS_IS_MY_REAL_SECRET_a83js9d7fkQz1mNvP0Lx')).toBe(false);
  });

  it('rejects missing, empty, and whitespace-only values', () => {
    expect(isWeakSecret(undefined)).toBe(true);
    expect(isWeakSecret(null)).toBe(true);
    expect(isWeakSecret('')).toBe(true);
    expect(isWeakSecret('    ')).toBe(true);
  });

  it('rejects values shorter than the minimum length', () => {
    expect(isWeakSecret('a'.repeat(MIN_SECRET_LENGTH - 1))).toBe(true);
    expect(isWeakSecret('a'.repeat(MIN_SECRET_LENGTH))).toBe(false);
  });

  it('rejects every value from the well-known weak list (case-insensitive)', () => {
    for (const v of WEAK_SECRET_VALUES) {
      expect(isWeakSecret(v)).toBe(true);
      expect(isWeakSecret(v.toUpperCase())).toBe(true);
    }
  });

  it('rejects values that embed a placeholder fragment', () => {
    for (const frag of WEAK_SECRET_SUBSTRINGS) {
      expect(isWeakSecret(`my-prefix-${frag}-suffix-padded-to-32-chars-long`)).toBe(true);
    }
  });

  it('rejects the exact .env.example placeholders', () => {
    expect(isWeakSecret('change_me_to_a_random_32_character_string')).toBe(true);
    expect(isWeakSecret('generate_a_random_secret_that_is_at_least_32_chars_long')).toBe(true);
  });

  it('rejects the test-suite fallback secret from routes.test.js history', () => {
    expect(isWeakSecret('test-secret-that-is-at-least-32-chars-long!!')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isWeakSecret(`  ${STRONG}  `)).toBe(false);
    expect(isWeakSecret('  changeme  ')).toBe(true);
  });
});

describe('scrubForLog (errorHandler PII scrubbing)', () => {
  it('redacts emails in free text, keeping the domain', () => {
    const out = scrubForLog({ message: 'user john.doe@gmail.com failed after retry' });
    expect(out.message).toContain('j***@gmail.com');
    expect(out.message).not.toContain('john.doe@gmail.com');
  });

  it('redacts bearer/basic tokens in free text', () => {
    const out = scrubForLog({ message: 'rejected Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' });
    expect(out.message).toContain('[redacted]');
    expect(out.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts values under PII-named keys at any depth', () => {
    const out = scrubForLog({
      name: 'Error',
      requestBody: { email: 'a@b.com', password: 'hunter2', nested: { token: 't1', ok: 1 } },
    });
    expect(out.requestBody.email).toBe('[redacted]');
    expect(out.requestBody.password).toBe('[redacted]');
    expect(out.requestBody.nested.token).toBe('[redacted]');
    expect(out.requestBody.nested.ok).toBe(1);
  });

  it('caps message length, array size, and recursion depth', () => {
    const out = scrubForLog({ message: 'x'.repeat(1000), list: [1, 2, 3, 4, 5, 6, 7, 8], deep: { a: { b: { c: 'leak' } } } });
    expect(out.message).toHaveLength(500);
    expect(out.list).toHaveLength(5);
    // MAX_LOG_DEPTH = 3: values beyond depth 3 collapse to '[truncated]'
    expect(out.deep.a.b).toBe('[truncated]');
    expect(JSON.stringify(out)).not.toContain('leak');
  });

  it('preserves the error name and non-PII fields', () => {
    const out = scrubForLog({ name: 'TypeError', message: 'Cannot read properties of undefined' });
    expect(out.name).toBe('TypeError');
    expect(out.message).toBe('Cannot read properties of undefined');
  });
});
