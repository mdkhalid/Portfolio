/**
 * Basic route-level verification tests.
 * Run with: npx jest server/__tests__/routes.test.js --forceExit
 * Requires a running MongoDB instance.
 *
 * Setup: npm install --save-dev jest supertest
 */

// Set test env BEFORE any requires
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-chars-long!!';
process.env.ANALYTICS_SALT = 'test-salt';
process.env.CONTACT_MIN_INTERVAL_MS = '0';

const request = require('supertest');

let app;

function getApp() {
  // Lazy-require so env vars are set first
  app = require('../server');
  return app;
}

// ─── Health Check Tests ─────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeAll(() => {
    getApp();
  });

  it('should return 200 with ok: true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).not.toHaveProperty('env');
  });
});

// ─── Public Route Tests ──────────────────────────────────────────────────────

describe('Public Routes', () => {
  beforeAll(() => {
    getApp();
  });

  it('GET /api/profile should return a profile object', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  it('GET /api/skills should return an array', async () => {
    const res = await request(app).get('/api/skills');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/experiences should return an array', async () => {
    const res = await request(app).get('/api/experiences');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/education should return an array', async () => {
    const res = await request(app).get('/api/education');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/certifications should return an array', async () => {
    const res = await request(app).get('/api/certifications');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/projects should return an array', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/articles should return paginated articles', async () => {
    const res = await request(app).get('/api/articles');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('hasMore');
  });

  it('GET /api/postmortems should return paginated postmortems', async () => {
    const res = await request(app).get('/api/postmortems');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('hasMore');
  });

  it('GET /api/resumes should return an array', async () => {
    const res = await request(app).get('/api/resumes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Auth-protected Routes Tests ─────────────────────────────────────────────

describe('Protected Routes (no auth)', () => {
  beforeAll(() => {
    getApp();
  });

  it('should return 401 for /api/admin/articles without token', async () => {
    const res = await request(app).get('/api/admin/articles');
    expect(res.status).toBe(401);
  });

  it('should return 401 for /api/activity without token', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(401);
  });

  it('should return 401 for POST /api/articles without token', async () => {
    const res = await request(app).post('/api/articles').send({});
    expect(res.status).toBe(401);
  });

  it('should return 401 for PUT /api/profile without token', async () => {
    const res = await request(app).put('/api/profile').send({});
    expect(res.status).toBe(401);
  });
});

// ─── Auth Endpoints Tests ────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeAll(() => {
    getApp();
  });

  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('should reject invalid username format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ab', password: 'validpassword123' });
    expect(res.status).toBe(400);
  });
});

// ─── Contact Endpoint Tests ──────────────────────────────────────────────────

describe('POST /api/contact', () => {
  beforeAll(() => {
    getApp();
  });

  it('should return 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({});
    expect(res.status).toBe(400);
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test', email: 'notanemail', message: 'Hello this is a test message that is long enough' });
    expect(res.status).toBe(400);
  });

  it('should reject short message', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test', email: 'test@example.com', message: 'Hi' });
    expect(res.status).toBe(400);
  });
});

// ─── Jobs & Matching Endpoints Tests (Phase 2) ──────────────────────────────

describe('Jobs Endpoints (Phase 2)', () => {
  beforeAll(() => {
    getApp();
  });

  it('GET /api/jobs should return 401 without auth token', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(401);
  });

  it('POST /api/jobs/match should return 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs/match').send({});
    expect(res.status).toBe(401);
  });

  it('PUT /api/jobs/123456789012345678901234 should return 401 without auth token', async () => {
    const res = await request(app).put('/api/jobs/123456789012345678901234').send({ status: 'applied' });
    expect(res.status).toBe(401);
  });

  it('GET /api/pipeline/status should return 401 without auth token', async () => {
    const res = await request(app).get('/api/pipeline/status');
    expect(res.status).toBe(401);
  });

  it('POST /api/pipeline/pause should return 401 without auth token', async () => {
    const res = await request(app).post('/api/pipeline/pause');
    expect(res.status).toBe(401);
  });

  it('PUT /api/pipeline/budget should return 401 without auth token', async () => {
    const res = await request(app).put('/api/pipeline/budget').send({ aiDailyBudget: 50 });
    expect(res.status).toBe(401);
  });

  it('PUT /api/job-sites/naukri/cookies should return 401 without auth token', async () => {
    const res = await request(app).put('/api/job-sites/naukri/cookies').send({ cookies: 'a=1; b=2' });
    expect(res.status).toBe(401);
  });

  it('POST /api/jobs/apply should return 401 without auth token', async () => {
    const res = await request(app).post('/api/jobs/apply').send({ jobIds: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/resume/generate should return 401 without auth token', async () => {
    const res = await request(app).post('/api/resume/generate').send({ jobId: '123456789012345678901234' });
    expect(res.status).toBe(401);
  });

  it('POST /api/resume/generate should return 401 without auth token (bulk)', async () => {
    const res = await request(app).post('/api/resume/generate').send({ jobIds: [] });
    expect(res.status).toBe(401);
  });

  it('GET /api/resume/generated should return 401 without auth token', async () => {
    const res = await request(app).get('/api/resume/generated');
    expect(res.status).toBe(401);
  });

  it('GET /api/applications should return 401 without auth token', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  it('PUT /api/applications/123456789012345678901234 should return 401 without auth token', async () => {
    const res = await request(app).put('/api/applications/123456789012345678901234').send({ status: 'applied' });
    expect(res.status).toBe(401);
  });

  it('POST /api/applications/123456789012345678901234/retry should return 401 without auth token', async () => {
    const res = await request(app).post('/api/applications/123456789012345678901234/retry');
    expect(res.status).toBe(401);
  });

  it('POST /api/applications/123456789012345678901234/answers should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/applications/123456789012345678901234/answers')
      .send({ fields: { notice_period: '30 days' } });
    expect(res.status).toBe(401);
  });
});

describe('Notifications Endpoints (Phase 6)', () => {
  it('GET /api/notifications should return 401 without auth token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/unread-count should return 401 without auth token', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('PUT /api/notifications/read-all should return 401 without auth token', async () => {
    const res = await request(app).put('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('PUT /api/notifications/123456789012345678901234/read should return 401 without auth token', async () => {
    const res = await request(app).put('/api/notifications/123456789012345678901234/read');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications should return empty list then list created notifications', async () => {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const Admin = require('../models/Admin');
    const UserSettings = require('../models/UserSettings');
    const Notification = require('../models/Notification');
    const { notify } = require('../services/notifications');

    await Admin.deleteMany({});
    await UserSettings.deleteMany({});
    const admin = await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });
    await UserSettings.create({ userId: admin._id });

    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    const csrfRes = await agent.get('/api/csrf-token');
    agent.set('Authorization', 'Bearer ' + login.body.token);
    agent.set('x-csrf-token', csrfRes.body.csrfToken);

    const adminId = admin._id;

    const empty = await agent.get('/api/notifications');
    expect(empty.status).toBe(200);
    expect(Array.isArray(empty.body.items)).toBe(true);

    await notify({
      userId: adminId,
      type: 'apply_success',
      title: 'Applied — Senior React Developer',
      body: 'Acme · naukri',
      dedupeKey: 'test-apply-success',
    });
    await notify({
      userId: adminId,
      type: 'needs_input',
      title: 'Job needs your attention — Solution Architect',
      body: 'Acme needs input: notice_period.',
      dedupeKey: 'test-needs-input',
    });
    // duplicate dedupe should NOT create a second notification
    await notify({
      userId: adminId,
      type: 'apply_success',
      title: 'Applied — Senior React Developer',
      dedupeKey: 'test-apply-success',
    });

    const list = await agent.get('/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(2);
    expect(list.body.unreadCount).toBe(2);

    const countRes = await agent.get('/api/notifications/unread-count');
    expect(countRes.body.count).toBe(2);

    // mark one read
    const target = list.body.items.find((n) => n.type === 'needs_input');
    const readRes = await agent.put('/api/notifications/' + target._id + '/read');
    expect(readRes.status).toBe(200);

    const afterRead = await agent.get('/api/notifications/unread-count');
    expect(afterRead.body.count).toBe(1);

    // mark all read
    const allRes = await agent.put('/api/notifications/read-all');
    expect(allRes.status).toBe(200);
    expect(allRes.body.modified).toBe(1);
    const finalCount = await agent.get('/api/notifications/unread-count');
    expect(finalCount.body.count).toBe(0);

    await Notification.deleteMany({ userId: adminId });
  });
});

describe('Pipeline Notification Settings (Phase 6)', () => {
  it('GET /api/pipeline/status should return notification prefs and PUT /budget should update them', async () => {
    const bcrypt = require('bcryptjs');
    const Admin = require('../models/Admin');
    const UserSettings = require('../models/UserSettings');

    await Admin.deleteMany({});
    await UserSettings.deleteMany({});
    await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });

    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    const csrfRes = await agent.get('/api/csrf-token');
    agent.set('Authorization', 'Bearer ' + login.body.token);
    agent.set('x-csrf-token', csrfRes.body.csrfToken);

    const status = await agent.get('/api/pipeline/status');
    expect(status.status).toBe(200);
    expect(typeof status.body.notifyEmail).toBe('boolean');
    expect(['none', 'instant', 'daily']).toContain(status.body.notifyDigest);

    const put = await agent.put('/api/pipeline/budget').send({ notifyEmail: true, notifyDigest: 'daily' });
    expect(put.status).toBe(200);
    expect(put.body.notifyEmail).toBe(true);
    expect(put.body.notifyDigest).toBe('daily');

    const after = await agent.get('/api/pipeline/status');
    expect(after.body.notifyEmail).toBe(true);
    expect(after.body.notifyDigest).toBe('daily');

    // invalid digest should 400
    const bad = await agent.put('/api/pipeline/budget').send({ notifyDigest: 'hourly' });
    expect(bad.status).toBe(400);
  });
});

describe('Custom Job Sites + Manual Apply (Phase 6.5)', () => {
  it('adds a custom site, connects with cookie, adds manual job, marks applied/pass', async () => {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const Admin = require('../models/Admin');
    const UserSettings = require('../models/UserSettings');
    const UserJobSite = require('../models/UserJobSite');
    const Job = require('../models/Job');
    const Application = require('../models/Application');

    await Admin.deleteMany({});
    await UserSettings.deleteMany({});
    await UserJobSite.deleteMany({});
    await Job.deleteMany({});
    await Application.deleteMany({});
    const admin = await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });
    await UserSettings.create({ userId: admin._id });

    // Sign the JWT directly to avoid the /api/auth/login rate limiter
    // (earlier tests in this file already consume the 5-login window).
    const token = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/csrf-token');
    agent.set('Authorization', 'Bearer ' + token);
    agent.set('x-csrf-token', csrfRes.body.csrfToken);

    const adminId = admin._id;

    // GET should list built-in sites even before config
    const list = await agent.get('/api/job-sites');
    expect(list.status).toBe(200);
    expect(list.body.some((s) => s.name === 'naukri')).toBe(true);

    // Add a custom site
    const added = await agent.post('/api/job-sites').send({ label: 'LinkedIn', baseUrl: 'https://www.linkedin.com' });
    expect(added.status).toBe(201);
    expect(added.body.name).toBe('linkedin');
    expect(added.body.custom).toBe(true);

    // Duplicate custom site should 409
    const dup = await agent.post('/api/job-sites').send({ label: 'LinkedIn', baseUrl: 'https://www.linkedin.com' });
    expect(dup.status).toBe(409);

    // Save credentials for the custom site (no real login test to avoid browser)
    const put = await agent.put('/api/job-sites/linkedin').send({ email: 'a@b.com', password: 'secret123', enabled: true });
    expect(put.status).toBe(200);
    expect(put.body.custom).toBe(true);
    expect(put.body.credentials.email).toContain('a@b');

    // Manual apply list should be empty initially
    const manualEmpty = await agent.get('/api/jobs/manual');
    expect(manualEmpty.status).toBe(200);
    expect(manualEmpty.body.items.length).toBe(0);

    // Add a manual job on the custom site
    const jobAdd = await agent.post('/api/jobs/manual').send({
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://www.linkedin.com/jobs/view/12345',
      site: 'linkedin',
      location: 'Remote',
    });
    expect(jobAdd.status).toBe(201);
    expect(jobAdd.body.job.needsManualApply).toBe(true);

    // Manual list should now include it
    const manualList = await agent.get('/api/jobs/manual');
    expect(manualList.body.items.length).toBe(1);
    expect(manualList.body.items[0].site).toBe('linkedin');

    // Adding a job on an unknown site should fail
    const badSite = await agent.post('/api/jobs/manual').send({
      title: 'X',
      company: 'Y',
      url: 'https://example.com/jobs/1',
      site: 'nope',
    });
    expect(badSite.status).toBe(400);

    // Mark applied → should clear needsManualApply and create an Application
    const jobId = jobAdd.body.job._id;
    const applied = await agent.post(`/api/jobs/${jobId}/mark-applied`);
    expect(applied.status).toBe(200);
    expect(applied.body.needsManualApply).toBe(false);
    expect(applied.body.status).toBe('applied');

    const appDoc = await Application.findOne({ userId: adminId, jobId }).lean();
    expect(appDoc).toBeTruthy();
    expect(appDoc.status).toBe('applied');
    expect(appDoc.appliedVia).toBe('manual');

    // Manual list no longer shows it
    const afterApplied = await agent.get('/api/jobs/manual');
    expect(afterApplied.body.items.length).toBe(0);

    // Unknown site in job-sites PUT should 400
    const unknownPut = await agent.put('/api/job-sites/unknown-site').send({ email: 'a@b.com', password: 'secret123' });
    expect(unknownPut.status).toBe(400);

    await UserJobSite.deleteMany({ userId: adminId });
    await Job.deleteMany({ userId: adminId });
    await Application.deleteMany({ userId: adminId });
  });
});
