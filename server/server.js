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

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes
app.get('/api/profile', profileCtrl.getAll);
app.get('/api/skills', skillsCtrl.getAll);
app.get('/api/experiences', experiencesCtrl.getAll);
app.get('/api/education', educationCtrl.getAll);
app.get('/api/certifications', certificationsCtrl.getAll);
app.get('/api/projects', projectsCtrl.getAll);
app.get('/api/resumes', resumeCtrl.getAll);
app.post('/api/analytics/track', analyticsCtrl.track);

// Auth
app.use('/api/auth', require('./routes/auth'));

app.use('/api/upload', auth, require('./routes/upload'));
app.use('/api/resume-files', auth, require('./routes/upload-resume'));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
