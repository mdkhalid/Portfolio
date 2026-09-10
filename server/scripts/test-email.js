/**
 * Email notification smoke test (Phase 4.3).
 *
 * Verifies the nodemailer transport is configured correctly and that a real
 * email goes out through your configured SMTP account. Safe to run at any
 * time — it sends at most one email to your own address.
 *
 * Usage (from server/):
 *   EMAIL_USER=you@gmail.com EMAIL_PASS=app-password node scripts/test-email.js
 *   (or put EMAIL_USER / EMAIL_PASS in server/.env and just run the script)
 *
 * Exit codes: 0 = sent, 1 = not configured / send failed (see message).
 */
const path = require('path');

// Load server/.env exactly like config/env.js does (override OS-level values).
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true, quiet: true });

const env = {
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
};

if (!env.EMAIL_USER || !env.EMAIL_PASS) {
  console.error(
    '[email-smoke] SKIP: EMAIL_USER / EMAIL_PASS not set.\n' +
      '  Set them in server/.env (Gmail requires an App Password:\n' +
      '  https://support.google.com/accounts/answer/185833) and re-run.'
  );
  process.exit(1);
}

const { sendEmail } = require('../services/notifications');

(async () => {
  const stamp = new Date().toISOString();
  const ok = await sendEmail({
    subject: `[portfolio] email smoke test ${stamp}`,
    text:
      'This is a one-off smoke test of the portfolio notification email path.\n' +
      `Sent at ${stamp}. If you received this, EMAIL_USER/EMAIL_PASS are working.\n` +
      'The daily digest loop (scheduler tick + 6h interval) uses the same transport.',
    html:
      '<p>This is a one-off smoke test of the portfolio notification email path.</p>' +
      `<p>Sent at ${stamp}. If you received this, EMAIL_USER/EMAIL_PASS are working.</p>` +
      '<p>The daily digest loop (scheduler tick + 6h interval) uses the same transport.</p>',
  });

  if (ok) {
    console.log(`[email-smoke] OK: sent to ${env.EMAIL_USER} at ${stamp}`);
    process.exit(0);
  } else {
    console.error('[email-smoke] FAIL: sendEmail() returned false — check [notify] logs above.');
    process.exit(1);
  }
})();
