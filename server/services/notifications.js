const env = require('../config/env');
const Notification = require('../models/Notification');
const UserSettings = require('../models/UserSettings');

let _io = null;

/** Register the live Socket.io instance for in-app notification broadcasts. */
function setIO(io) {
  _io = io;
}

// In-memory email rate limiter: max instant emails per user per rolling hour.
// Past the cap, emails fall back to the daily digest (prevents spam on bulk runs).
const emailSends = new Map();
const INSTANT_EMAIL_CAP = 8;

function emailSentThisHour(userId) {
  const now = Date.now();
  const list = (emailSends.get(String(userId)) || []).filter((t) => now - t < 60 * 60 * 1000);
  emailSends.set(String(userId), list);
  return list.length;
}

// Lazy nodemailer transport — never crashes the app if SMTP is unconfigured.
let _transport = null;
function getTransport() {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) return null;
  if (_transport) return _transport;
  const nodemailer = require('nodemailer');
  _transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
  });
  return _transport;
}

/**
 * Send one notification email (from -> EMAIL_USER). Never throws.
 * to: the admin's own inbox (single-user system) from EMAIL_USER.
 */
async function sendEmail({ subject, text, html }) {
  const transport = getTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: `"${env.JOB_NOTIFY_FROM || 'Job Automation'}" <${env.EMAIL_USER}>`,
      to: env.EMAIL_USER,
      subject: subject.slice(0, 200),
      text,
      html: html || undefined,
    });
    return true;
  } catch (err) {
    console.error('[notify] email failed:', err?.message || err);
    return false;
  }
}

/** Read per-user email preference. */
async function getNotifySettings(userId) {
  const settings = await UserSettings.findOne({ userId }).lean();
  return {
    emailEnabled: !!settings?.notifyEmail,
    digest: settings?.notifyDigest || 'instant',
  };
}

/**
 * Create an in-app notification and fan it out:
 *  - socket.io `notify:inapp` event to the admin dashboard
 *  - optional email (instant or queued for daily digest), rate-limited
 * `dedupeKey` (optional): skip if a matching notification exists within maxAgeMs.
 */
async function notify({ userId, type, title, body = '', metadata = {}, dedupeKey = '', maxAgeMs = 6 * 60 * 60 * 1000 }) {
  try {
    if (dedupeKey) {
      const existing = await Notification.findOne({
        userId,
        dedupeKey,
        createdAt: { $gte: new Date(Date.now() - maxAgeMs) },
      })
        .select('_id')
        .lean();
      if (existing) return null;
    }

    const doc = await Notification.create({
      userId,
      type,
      title: String(title).slice(0, 200),
      body: String(body).slice(0, 1000),
      metadata,
      dedupeKey,
    });

    if (_io) {
      _io.to('admin-room').emit('notify:inapp', {
        _id: String(doc._id),
        type: doc.type,
        title: doc.title,
        body: doc.body,
        metadata: doc.metadata,
        read: false,
        createdAt: doc.createdAt,
      });
    }

    // Email handling
    const prefs = await getNotifySettings(userId);
    if (prefs.emailEnabled) {
      if (prefs.digest === 'daily') {
        await Notification.updateOne({ _id: doc._id }, { $set: { digestPending: true } });
      } else if (prefs.digest === 'instant' && emailSentThisHour(userId) < INSTANT_EMAIL_CAP) {
        emailSends.set(String(userId), [...(emailSends.get(String(userId)) || []), Date.now()]);
        sendEmail({ subject: title, text: body || title }).catch(() => {});
      } else {
        // rate-capped instant → fall back to digest
        await Notification.updateOne({ _id: doc._id }, { $set: { digestPending: true } });
      }
    }
    return doc;
  } catch (err) {
    console.error('[notify] failed:', err?.message || err);
    return null;
  }
}

/** List recent notifications with unread count. */
async function listNotifications(userId, { page = 1, limit = 20 } = {}) {
  const query = { userId };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, read: false }),
  ]);
  return { items, total, unreadCount, page, limit };
}

async function unreadCount(userId) {
  return Notification.countDocuments({ userId, read: false });
}

async function markRead(userId, id) {
  const doc = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { read: true } },
    { new: true }
  ).lean();
  return doc;
}

async function markAllRead(userId) {
  const res = await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  return { modified: res.modifiedCount };
}

/**
 * Daily digest: group all digestPending notifications per user and send ONE
 * summary email, then mark them delivered. Called by the scheduler.
 */
async function sendDailyDigests() {
  if (!getTransport()) return;
  const pending = await Notification.find({ digestPending: true, emailDelivered: false })
    .sort({ createdAt: 1 })
    .lean();
  const byUser = {};
  for (const n of pending) {
    if (!byUser[String(n.userId)]) byUser[String(n.userId)] = [];
    byUser[String(n.userId)].push(n);
  }
  for (const [userId, items] of Object.entries(byUser)) {
    const counts = {};
    for (const n of items) counts[n.type] = (counts[n.type] || 0) + 1;
    const lines = items
      .map((n) => `• ${n.title}${n.body ? ' — ' + n.body : ''}`)
      .slice(0, 30);
    const summary = `You have ${items.length} update(s) from your job application pipeline:\n\n` + lines.join('\n');
    const ok = await sendEmail({
      subject: `Job pipeline digest — ${items.length} update(s)`,
      text: summary,
      html: summary.replace(/\n/g, '<br/>'),
    });
    if (ok) {
      await Notification.updateMany(
        { _id: { $in: items.map((n) => n._id) } },
        { $set: { emailDelivered: true, digestPending: false } }
      );
    }
  }
}

module.exports = {
  setIO,
  notify,
  sendEmail,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  sendDailyDigests,
  getNotifySettings,
};
