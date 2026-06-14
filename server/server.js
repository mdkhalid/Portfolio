const env = require('./config/env');
const express = require('express');
const http = require('http');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { setupSocket } = require('./socket');
const auth = require('./middleware/auth');
const profileCtrl = require('./routes/profile');
const skillsCtrl = require('./routes/skills');
const experiencesCtrl = require('./routes/experiences');
const educationCtrl = require('./routes/education');
const certificationsCtrl = require('./routes/certifications');
const projectsCtrl = require('./routes/projects');
const resumeCtrl = require('./routes/resumes');
const analyticsCtrl = require('./routes/analytics');
const contactCtrl = require('./routes/contact');
const messagesCtrl = require('./routes/messages');
const chatCtrl = require('./routes/chat');
const articlesCtrl = require('./routes/articles');
const postmortemsCtrl = require('./routes/postmortems');
const leadsCtrl = require('./routes/leads');
const Activity = require('./models/Activity');
const Resume = require('./models/Resume');
const { authLimiter, contactLimiter, resumeLimiter, chatLimiter, atsLimiter } = require('./middleware/rateLimiter');
const atsRouter = require('./routes/ats');
const {
  helmetMiddleware,
  corsMiddleware,
  sanitizeMiddleware,
  hppMiddleware,
  compressionMiddleware,
  isProd,
} = require('./middleware/security');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
const { isPathSafe } = require('./utils/security');
const { csrfProtection, issueCsrfToken } = require('./middleware/csrf');

const app = express();

app.set('trust proxy', Number(env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(compressionMiddleware);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

app.use(sanitizeMiddleware);
app.use(hppMiddleware);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 1000,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

connectDB();

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    fallthrough: false,
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.get(
  '/api/download-resume/:filename',
  resumeLimiter,
  asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    if (!isPathSafe(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const resume = await Resume.findOne({ fileUrl: '/uploads/' + filename });
    if (!resume) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = path.join(__dirname, 'uploads', filename);
    const uploadsDir = path.join(__dirname, 'uploads');
    const resolved = path.resolve(file);
    if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    Activity.create({
      type: 'resume_download',
      description: 'Resume downloaded',
      metadata: { filename, ip: req.ip, resumeId: resume._id },
    })
      .then(() => Activity.prune())
      .catch(() => {});
    res.download(resolved, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true, env: env.NODE_ENV }));

app.get('/api/csrf-token', issueCsrfToken);

app.get('/api/profile', profileCtrl.getAll);
app.get('/api/skills', skillsCtrl.getAll);
app.get('/api/experiences', experiencesCtrl.getAll);
app.get('/api/education', educationCtrl.getAll);
app.get('/api/certifications', certificationsCtrl.getAll);
app.get('/api/projects', projectsCtrl.getAll);
app.get('/api/resumes', resumeCtrl.getAll);
app.post('/api/analytics/track', analyticsCtrl.track);
app.post('/api/contact', contactLimiter, contactCtrl.send);

app.get('/api/articles', articlesCtrl.getAll);
app.get('/api/articles/:slug', articlesCtrl.getBySlug);

app.get('/api/postmortems', postmortemsCtrl.getAll);
app.get('/api/postmortems/:slug', postmortemsCtrl.getBySlug);

app.post('/api/chat', chatLimiter, chatCtrl.chat);
app.post('/api/ats-score', atsLimiter, atsRouter.uploadMiddleware, atsRouter.score);

app.use('/api/auth', authLimiter, require('./routes/auth'));

app.get('/api/activity', auth, require('./routes/activity').getRecent);

app.use('/api/upload', auth, csrfProtection, require('./routes/upload'));
app.use('/api/resume-files', auth, csrfProtection, require('./routes/upload-resume'));
app.get('/api/admin/articles', auth, articlesCtrl.getAllAdmin);
app.post('/api/articles', auth, csrfProtection, articlesCtrl.create);
app.put('/api/articles/:id', auth, csrfProtection, articlesCtrl.update);
app.delete('/api/articles/:id', auth, csrfProtection, articlesCtrl.remove);

app.get('/api/admin/postmortems', auth, postmortemsCtrl.getAllAdmin);
app.post('/api/postmortems', auth, csrfProtection, postmortemsCtrl.create);
app.put('/api/postmortems/:id', auth, csrfProtection, postmortemsCtrl.update);
app.delete('/api/postmortems/:id', auth, csrfProtection, postmortemsCtrl.remove);

app.put('/api/profile', auth, csrfProtection, profileCtrl.update);
app.post('/api/skills', auth, csrfProtection, skillsCtrl.create);
app.put('/api/skills/:id', auth, csrfProtection, skillsCtrl.update);
app.delete('/api/skills/:id', auth, csrfProtection, skillsCtrl.remove);
app.post('/api/experiences', auth, csrfProtection, experiencesCtrl.create);
app.put('/api/experiences/:id', auth, csrfProtection, experiencesCtrl.update);
app.delete('/api/experiences/:id', auth, csrfProtection, experiencesCtrl.remove);
app.post('/api/education', auth, csrfProtection, educationCtrl.create);
app.put('/api/education/:id', auth, csrfProtection, educationCtrl.update);
app.delete('/api/education/:id', auth, csrfProtection, educationCtrl.remove);
app.post('/api/certifications', auth, csrfProtection, certificationsCtrl.create);
app.put('/api/certifications/:id', auth, csrfProtection, certificationsCtrl.update);
app.delete('/api/certifications/:id', auth, csrfProtection, certificationsCtrl.remove);
app.post('/api/projects', auth, csrfProtection, projectsCtrl.create);
app.put('/api/projects/:id', auth, csrfProtection, projectsCtrl.update);
app.delete('/api/projects/:id', auth, csrfProtection, projectsCtrl.remove);
app.get('/api/analytics/stats', auth, analyticsCtrl.stats);
app.get('/api/messages', auth, messagesCtrl.getAll);
app.put('/api/messages/:id/read', auth, csrfProtection, messagesCtrl.markRead);
app.delete('/api/messages/:id', auth, csrfProtection, messagesCtrl.remove);

app.get('/api/leads', auth, leadsCtrl.getAll);
app.put('/api/leads/:id/status', auth, csrfProtection, leadsCtrl.markStatus);
app.delete('/api/leads/:id', auth, csrfProtection, leadsCtrl.remove);
app.get('/api/livechat/:id/messages', auth, leadsCtrl.getChatMessages);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const PORT = env.PORT;
  const server = http.createServer(app);
  setupSocket(server);
  server.listen(PORT, () =>
    console.log(`Server running on port ${PORT} (${env.NODE_ENV})`)
  );

  const shutdown = (signal) => {
    console.log(`\n[shutdown] Received ${signal}, closing server...`);
    server.close(() => {
      require('mongoose').connection.close(false, () => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
  });
}
