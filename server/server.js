require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
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
const Activity = require('./models/Activity');
const { authLimiter, contactLimiter, resumeLimiter, chatLimiter, atsLimiter } = require('./middleware/rateLimiter');
const atsRouter = require('./routes/ats');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate-limited resume download
app.get('/api/download-resume/:filename', resumeLimiter, (req, res) => {
  const file = path.join(__dirname, 'uploads', req.params.filename);
  // Log activity (async, don't block download)
  Activity.create({
    type: 'resume_download',
    description: 'Resume downloaded',
    metadata: { filename: req.params.filename, ip: req.ip },
  }).then(() => Activity.prune()).catch(() => {});
  res.download(file);
});

// Public routes
app.get('/api/profile', profileCtrl.getAll);
app.get('/api/skills', skillsCtrl.getAll);
app.get('/api/experiences', experiencesCtrl.getAll);
app.get('/api/education', educationCtrl.getAll);
app.get('/api/certifications', certificationsCtrl.getAll);
app.get('/api/projects', projectsCtrl.getAll);
app.get('/api/resumes', resumeCtrl.getAll);
app.post('/api/analytics/track', analyticsCtrl.track);
app.post('/api/contact', contactLimiter, contactCtrl.send);

// Articles
app.get('/api/articles', articlesCtrl.getAll);
app.get('/api/articles/:slug', articlesCtrl.getBySlug);

// AI Chat
app.post('/api/chat', chatLimiter, chatCtrl.chat);

// ATS Resume Scoring
app.post('/api/ats-score', atsLimiter, atsRouter.uploadMiddleware, atsRouter.score);

// Auth
app.use('/api/auth', authLimiter, require('./routes/auth'));

app.get('/api/activity', auth, require('./routes/activity').getRecent);

app.use('/api/upload', auth, require('./routes/upload'));
app.use('/api/resume-files', auth, require('./routes/upload-resume'));
app.get('/api/admin/articles', auth, articlesCtrl.getAllAdmin);
app.post('/api/articles', auth, articlesCtrl.create);
app.put('/api/articles/:id', auth, articlesCtrl.update);
app.delete('/api/articles/:id', auth, articlesCtrl.remove);

// Protected routes
app.put('/api/profile', auth, profileCtrl.update);
app.post('/api/skills', auth, skillsCtrl.create);
app.put('/api/skills/:id', auth, skillsCtrl.update);
app.delete('/api/skills/:id', auth, skillsCtrl.remove);
app.post('/api/experiences', auth, experiencesCtrl.create);
app.put('/api/experiences/:id', auth, experiencesCtrl.update);
app.delete('/api/experiences/:id', auth, experiencesCtrl.remove);
app.post('/api/education', auth, educationCtrl.create);
app.put('/api/education/:id', auth, educationCtrl.update);
app.delete('/api/education/:id', auth, educationCtrl.remove);
app.post('/api/certifications', auth, certificationsCtrl.create);
app.put('/api/certifications/:id', auth, certificationsCtrl.update);
app.delete('/api/certifications/:id', auth, certificationsCtrl.remove);
app.post('/api/projects', auth, projectsCtrl.create);
app.put('/api/projects/:id', auth, projectsCtrl.update);
app.delete('/api/projects/:id', auth, projectsCtrl.remove);
app.get('/api/analytics/stats', auth, analyticsCtrl.stats);
app.get('/api/messages', auth, messagesCtrl.getAll);
app.put('/api/messages/:id/read', auth, messagesCtrl.markRead);
app.delete('/api/messages/:id', auth, messagesCtrl.remove);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
