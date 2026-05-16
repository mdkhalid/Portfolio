const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const Resume = require('../models/Resume');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, 'resume-' + Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|txt)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Only PDF, DOC, DOCX, or TXT files are allowed'));
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const item = await Resume.create({ label: req.body.label, fileUrl: '/uploads/' + req.file.filename });
  res.status(201).json(item);
});

router.put('/:id', upload.single('file'), async (req, res) => {
  const update = {};
  if (req.body.label) update.label = req.body.label;
  if (req.file) update.fileUrl = '/uploads/' + req.file.filename;
  const item = await Resume.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await Resume.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

router.use((err, req, res, next) => {
  res.status(400).json({ message: err.message });
});

module.exports = router;
