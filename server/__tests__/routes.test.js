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
    expect(res.body).toHaveProperty('env', 'test');
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
