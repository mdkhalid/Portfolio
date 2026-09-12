/**
 * Phase 5 (GAP_ANALYSIS 5.2) — coverage for blog/postmortem CRUD happy-paths,
 * social OAuth state validation, and the apply-worker helpers.
 * Run with: npx jest --forceExit --runInBand (from server/)
 * Requires a running MongoDB instance (defaults to portfolio_test).
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-chars-long!!';
process.env.ANALYTICS_SALT = 'test-salt';
process.env.CONTACT_MIN_INTERVAL_MS = '0';
// Never pick up real OAuth apps in tests — connect routes must 503.
delete process.env.LINKEDIN_CLIENT_ID;
delete process.env.LINKEDIN_CLIENT_SECRET;
delete process.env.X_CLIENT_ID;
delete process.env.X_CLIENT_SECRET;

const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

let app;
function getApp() {
  if (!app) app = require('../server');
  return app;
}

/** Require the server (starts the DB connection) and wait until it is up. */
async function ensureDb() {
  getApp();
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connection.asPromise();
  }
}

beforeAll(async () => {
  await ensureDb();
}, 30000);

/** Authenticated agent without touching the rate-limited login endpoint. */
async function authAgent(tag) {
  await ensureDb();
  const Admin = require('../models/Admin');
  const username = `phase5_${tag}_${Date.now()}`;
  await Admin.deleteOne({ username });
  const admin = await Admin.create({ username, password: bcrypt.hashSync('pw123456', 10) });
  const token = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const agent = request.agent(getApp());
  const csrf = await agent.get('/api/csrf-token');
  expect(csrf.status).toBe(200);
  agent.set('Authorization', 'Bearer ' + token);
  agent.set('x-csrf-token', csrf.body.csrfToken);
  return { agent, admin };
}

// ─── Blog (articles) CRUD happy-path ─────────────────────────────────────────

describe('Blog articles CRUD (Phase 5.2)', () => {
  it('creates, reads, updates, and deletes an article', async () => {
    const { agent } = await authAgent('blog');
    const Article = require('../models/Article');
    const title = `Phase5 article ${Date.now()}`;

    const created = await agent.post('/api/articles').send({ title, content: '# Hello\nBody text here.', published: true });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBeTruthy();
    const id = created.body._id;
    const slug = created.body.slug;

    const list = await request(getApp()).get('/api/articles?limit=5');
    expect(list.status).toBe(200);
    expect(list.body.items.some((a) => a.slug === slug)).toBe(true);

    const bySlug = await request(getApp()).get(`/api/articles/${slug}`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.title).toBe(title);

    const updated = await agent.put(`/api/articles/${id}`).send({ title: `${title} v2` });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe(`${title} v2`);

    const removed = await agent.delete(`/api/articles/${id}`);
    expect(removed.status).toBe(200);
    const gone = await request(getApp()).get(`/api/articles/${slug}`);
    expect(gone.status).toBe(404);

    await Article.deleteMany({ title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
  });

  it('rejects invalid article input', async () => {
    const { agent } = await authAgent('blogneg');
    const noTitle = await agent.post('/api/articles').send({ content: 'no title' });
    expect(noTitle.status).toBe(400);
    const badId = await agent.put('/api/articles/not-an-id').send({ title: 'x' });
    expect(badId.status).toBe(400);
  });
});

// ─── Postmortems CRUD happy-path ─────────────────────────────────────────────

describe('Postmortems CRUD (Phase 5.2)', () => {
  it('creates, reads, updates, and deletes a postmortem', async () => {
    const { agent } = await authAgent('pm');
    const title = `Phase5 pm ${Date.now()}`;

    const created = await agent.post('/api/postmortems').send({
      title,
      content: 'What happened.',
      severity: 'SEV2',
      status: 'monitoring',
      published: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.severity).toBe('SEV2');
    const id = created.body._id;
    const slug = created.body.slug;

    const bySlug = await request(getApp()).get(`/api/postmortems/${slug}`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.title).toBe(title);

    const updated = await agent.put(`/api/postmortems/${id}`).send({ status: 'resolved' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('resolved');

    const removed = await agent.delete(`/api/postmortems/${id}`);
    expect(removed.status).toBe(200);
    const gone = await request(getApp()).get(`/api/postmortems/${slug}`);
    expect(gone.status).toBe(404);
  });

  it('rejects an invalid severity', async () => {
    const { agent } = await authAgent('pmneg');
    const res = await agent.post('/api/postmortems').send({ title: 'Bad sev', severity: 'SEV9' });
    expect(res.status).toBe(400);
  });
});

// ─── Social OAuth state validation ───────────────────────────────────────────

describe('Social OAuth state (Phase 5.2)', () => {
  const oauth = require('../services/socialOauth');

  it('round-trips a signed state payload', () => {
    const state = oauth.createState('linkedin');
    const payload = oauth.verifyState(state);
    expect(payload).toBeTruthy();
    expect(payload.platform).toBe('linkedin');
    expect(typeof payload.ts).toBe('number');
  });

  it('carries the PKCE verifier for X states', () => {
    const { verifier } = oauth.createPkcePair();
    const state = oauth.createState('x', { verifier });
    const payload = oauth.verifyState(state);
    expect(payload.platform).toBe('x');
    expect(payload.verifier).toBe(verifier);
  });

  it('rejects tampered and malformed states', () => {
    const state = oauth.createState('linkedin');
    const dot = state.lastIndexOf('.');
    const tampered = `${state.slice(0, dot)}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(oauth.verifyState(tampered)).toBeNull();
    expect(oauth.verifyState('garbage')).toBeNull();
    expect(oauth.verifyState('')).toBeNull();
    expect(oauth.verifyState(null)).toBeNull();
  });

  it('rejects expired states', () => {
    const state = oauth.createState('linkedin');
    const realNow = Date.now;
    Date.now = () => realNow() + oauth.STATE_MAX_AGE_MS + 60_000;
    try {
      expect(oauth.verifyState(state)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it('builds a valid PKCE S256 pair', () => {
    const { verifier, challenge } = oauth.createPkcePair();
    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
    expect(verifier.length).toBeGreaterThan(40);
  });

  it('OAuth entry points are guarded', async () => {
    getApp();
    // No auth → 401 on the protected status endpoint.
    const anon = await request(app).get('/api/social/connections');
    expect(anon.status).toBe(401);
    // Unconfigured apps fail closed with a popup page, not a redirect.
    const li = await request(app).get('/api/social/linkedin/connect');
    expect(li.status).toBe(503);
    const x = await request(app).get('/api/social/x/connect');
    expect(x.status).toBe(503);
    // Invalid/tampered state on callback → 400, never an exchange attempt.
    const cb = await request(app).get('/api/social/linkedin/callback?code=abc&state=bogus');
    expect(cb.status).toBe(400);
    const noAuthPost = await request(app).post('/api/social/posts').send({ topicNotes: 'hi' });
    expect(noAuthPost.status).toBe(401);
  });
});

// ─── Apply worker helpers ────────────────────────────────────────────────────

describe('Apply worker (Phase 5.2)', () => {
  const worker = require('../queue/worker');

  it('defines the 4-step pipeline in order', () => {
    expect(worker.STEPS).toEqual(['fetch_jd', 'generate_resume', 'prepare_application', 'submit']);
  });

  it('classifies step failures into stable reasons', () => {
    expect(worker.mapNotAppliedReason(new Error('Login required, please sign in'))).toBe('login_failed');
    expect(worker.mapNotAppliedReason(new Error('Session cookie expired'))).toBe('login_failed');
    expect(worker.mapNotAppliedReason(new Error('Blocked by recaptcha bot detection'))).toBe('blocked_or_captcha');
    expect(worker.mapNotAppliedReason(new Error('Job expired, no longer accepting applications'))).toBe('job_expired');
    expect(worker.mapNotAppliedReason(new Error('Missing required field: phone'))).toBe('missing_info');
    expect(worker.mapNotAppliedReason(new Error('weird unknown boom'))).toBe('site_error');
  });

  it('emits one batch_complete summary with applied/failed/need-input counts', async () => {
    const Admin = require('../models/Admin');
    const Application = require('../models/Application');
    const Notification = require('../models/Notification');
    const username = `phase5_batch_${Date.now()}`;
    const admin = await Admin.create({ username, password: bcrypt.hashSync('pw123456', 10) });
    const batchId = `phase5-${Date.now()}`;
    const jobId = () => new mongoose.Types.ObjectId();
    await Application.create([
      { userId: admin._id, jobId: jobId(), site: 'naukri', status: 'applied', batchId },
      { userId: admin._id, jobId: jobId(), site: 'naukri', status: 'not_applied', batchId },
      {
        userId: admin._id, jobId: jobId(), site: 'naukri', status: 'pending', batchId,
        waitingFields: [{ key: 'notice_period', label: 'Notice period' }],
      },
    ]);

    await worker.maybeNotifyBatchComplete(batchId);
    const note = await Notification.findOne({ dedupeKey: `batch-${batchId}` }).lean();
    expect(note).toBeTruthy();
    expect(note.type).toBe('batch_complete');
    expect(note.body).toBe('1 applied · 1 failed · 1 need input · 0 canceled');
    expect(note.metadata).toMatchObject({ applied: 1, failed: 1, needInput: 1, canceled: 0 });

    await Application.deleteMany({ batchId });
    await Notification.deleteOne({ dedupeKey: `batch-${batchId}` });
    await Admin.deleteOne({ _id: admin._id });
  });

  it('skips the batch summary while applications are still active', async () => {
    const Admin = require('../models/Admin');
    const Application = require('../models/Application');
    const Notification = require('../models/Notification');
    const admin = await Admin.create({ username: `phase5_active_${Date.now()}`, password: bcrypt.hashSync('pw123456', 10) });
    const batchId = `phase5-active-${Date.now()}`;
    await Application.create({
      userId: admin._id, jobId: new mongoose.Types.ObjectId(), site: 'naukri', status: 'queued', batchId,
    });

    await worker.maybeNotifyBatchComplete(batchId);
    const note = await Notification.findOne({ dedupeKey: `batch-${batchId}` }).lean();
    expect(note).toBeNull();

    await Application.deleteMany({ batchId });
    await Admin.deleteOne({ _id: admin._id });
  });

  it('re-queues login_failed applications after a site reconnect', async () => {
    const Admin = require('../models/Admin');
    const Job = require('../models/Job');
    const Application = require('../models/Application');
    const admin = await Admin.create({ username: `phase5_req_${Date.now()}`, password: bcrypt.hashSync('pw123456', 10) });
    const job = await Job.create({
      userId: admin._id, title: 'Requeue Me', company: 'Acme', site: 'naukri', dedupeKey: `phase5-req-${Date.now()}`,
    });
    const appDoc = await Application.create({
      userId: admin._id, jobId: job._id, site: 'naukri', status: 'not_applied', notAppliedReason: 'login_failed',
    });

    const count = await worker.requeueLoginFailedApps(admin._id, 'naukri');
    expect(count).toBe(1);
    const after = await Application.findById(appDoc._id).lean();
    expect(after.status).toBe('queued');

    await Application.deleteOne({ _id: appDoc._id });
    await Job.deleteOne({ _id: job._id });
    await Admin.deleteOne({ _id: admin._id });
  });
});
