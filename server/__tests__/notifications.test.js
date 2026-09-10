/**
 * Unit tests for the email / digest path in services/notifications.js
 * (Phase 4.3). The nodemailer transport is mocked — these verify the
 * fan-out logic (instant vs daily vs rate-cap, digest grouping, and the
 * delivered-marking) without hitting a real SMTP server.
 *
 * A real-send smoke test lives in scripts/test-email.js (needs EMAIL_USER /
 * EMAIL_PASS set in server/.env).
 */

// The notification service caches `_transport`, so set env before requiring.
// NOTE: config/env.js loads server/.env with override:true — if that file has
// empty EMAIL_USER/EMAIL_PASS lines they would blank these, so the config
// object is patched after require instead of relying on process.env.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(48); // strong, not in weak list
process.env.ANALYTICS_SALT = process.env.ANALYTICS_SALT || 'test-salt';
process.env.CONTACT_MIN_INTERVAL_MS = process.env.CONTACT_MIN_INTERVAL_MS || '0';

// Mock nodemailer BEFORE the service (or anything that requires it) loads.
jest.mock('nodemailer', () => {
  const sent = [];
  const transport = {
    sendMail(opts) {
      sent.push(opts);
      return Promise.resolve({ messageId: 'mock-' + sent.length });
    },
  };
  return { __esModule: false, createTransport: () => transport, __sent: sent };
});

const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const envConfig = require('../config/env');

// Force-enable the SMTP transport for these tests regardless of what
// server/.env contains (empty EMAIL_USER lines would disable it).
envConfig.EMAIL_USER = 'smoke@example.invalid';
envConfig.EMAIL_PASS = 'smoke-pass';

const { sendEmail, notify, sendDailyDigests } = require('../services/notifications');
const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const UserSettings = require('../models/UserSettings');

const sent = nodemailer.__sent;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await Notification.deleteMany({});
  await UserSettings.deleteMany({});
  await Admin.deleteMany({});
  await mongoose.connection.close();
});

beforeEach(async () => {
  sent.length = 0;
  await Notification.deleteMany({});
  await UserSettings.deleteMany({});
});

describe('sendEmail (transport path)', () => {
  it('sends through nodemailer with subject/text and the configured from', async () => {
    const ok = await sendEmail({ subject: 'hello subject', text: 'hello body' });
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('hello subject');
    expect(sent[0].text).toBe('hello body');
    expect(sent[0].to).toBe('smoke@example.invalid');
  });

  it('caps the subject at 200 chars', async () => {
    await sendEmail({ subject: 'x'.repeat(500), text: 'body' });
    expect(sent[0].subject).toHaveLength(200);
  });

  it('never throws when transport is unset', async () => {
    const savedUser = envConfig.EMAIL_USER;
    const savedPass = envConfig.EMAIL_PASS;
    envConfig.EMAIL_USER = '';
    envConfig.EMAIL_PASS = '';
    jest.resetModules();
    const freshEnv = require('../config/env');
    freshEnv.EMAIL_USER = '';
    freshEnv.EMAIL_PASS = '';
    const fresh = require('../services/notifications');
    const ok = await fresh.sendEmail({ subject: 's', text: 't' });
    expect(ok).toBe(false);
    envConfig.EMAIL_USER = savedUser;
    envConfig.EMAIL_PASS = savedPass;
  });
});

describe('notify() email fan-out', () => {
  const mkAdmin = async (emailEnabled, digest) => {
    const bcrypt = require('bcryptjs');
    const admin = await Admin.create({ username: 'admin-' + Date.now(), password: bcrypt.hashSync('admin123', 10) });
    await UserSettings.create({ userId: admin._id, notifyEmail: emailEnabled, notifyDigest: digest });
    return admin;
  };

  it('sends an instant email when notifyEmail=true and digest=instant', async () => {
    const admin = await mkAdmin(true, 'instant');
    sent.length = 0;
    await notify({ userId: admin._id, type: 'apply_success', title: 'Applied — X', body: 'Acme · naukri' });
    expect(sent.length).toBe(1);
    expect(sent[0].subject).toBe('Applied — X');
  });

  it('queues for digest instead of sending when digest=daily', async () => {
    const admin = await mkAdmin(true, 'daily');
    await notify({ userId: admin._id, type: 'apply_success', title: 'Queued — X', body: 'should not email' });
    expect(sent).toHaveLength(0);
    const doc = await Notification.findOne({ userId: admin._id });
    expect(doc.digestPending).toBe(true);
  });

  it('does not email when notifyEmail=false', async () => {
    const admin = await mkAdmin(false, 'instant');
    await notify({ userId: admin._id, type: 'apply_success', title: 'No email — X' });
    expect(sent).toHaveLength(0);
    const doc = await Notification.findOne({ userId: admin._id });
    expect(doc.digestPending).toBe(false);
  });

  it('falls back to digest after the per-user instant cap', async () => {
    const admin = await mkAdmin(true, 'instant');
    // INSTANT_EMAIL_CAP is 8/hour — send cap+2, expect exactly cap emails.
    for (let i = 0; i < 10; i++) {
      await notify({ userId: admin._id, type: 'apply_success', title: 'T' + i, dedupeKey: 'k' + i });
    }
    expect(sent.length).toBe(8);
    const pending = await Notification.countDocuments({ userId: admin._id, digestPending: true });
    expect(pending).toBe(2);
  });
});

describe('sendDailyDigests() (scheduled loop)', () => {
  it('groups digestPending by user, sends one summary, marks delivered', async () => {
    const bcrypt = require('bcryptjs');
    const a1 = await Admin.create({ username: 'digest-1-' + Date.now(), password: bcrypt.hashSync('admin123', 10) });
    const a2 = await Admin.create({ username: 'digest-2-' + Date.now(), password: bcrypt.hashSync('admin123', 10) });
    await Notification.create([
      { userId: a1._id, type: 'apply_success', title: 'A1 one', digestPending: true },
      { userId: a1._id, type: 'needs_input', title: 'A1 two', digestPending: true },
      { userId: a2._id, type: 'apply_success', title: 'A2 one', digestPending: true },
    ]);

    await sendDailyDigests();

    expect(sent.length).toBe(2);
    // One digest per user: a 2-item summary and a 1-item summary.
    const two = sent.find((s) => s.text.includes('A1 one'));
    const one = sent.find((s) => s.text.includes('A2 one'));
    expect(two.subject).toContain('2 update');
    expect(one.subject).toContain('1 update');
    expect(two.text).toContain('A1 one');
    expect(two.text).toContain('A1 two');

    const stillPending = await Notification.countDocuments({ digestPending: true, emailDelivered: false });
    expect(stillPending).toBe(0);
    const delivered = await Notification.countDocuments({ emailDelivered: true });
    expect(delivered).toBe(3);
  });

  it('is a no-op when there is nothing pending', async () => {
    await sendDailyDigests();
    expect(sent).toHaveLength(0);
  });
});
