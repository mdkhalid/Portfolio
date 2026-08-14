const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Resume = require('../models/Resume');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');
const { validateFileType, ensureUploadsDir } = require('../utils/fileType');
const { isPathSafe } = require('../utils/security');

const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'txt'];
const MAX_SIZE = 10 * 1024 * 1024;

/** Remove a previously stored resume file from disk (best-effort, uploads dir only). */
const removeStoredFile = (fileUrl) => {
  try {
    if (!fileUrl) return;
    const fullPath = path.join(ensureUploadsDir(), path.basename(fileUrl));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error('[upload-resume] failed to remove old file:', err?.message || err);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!ALLOWED_EXTS.includes(ext)) {
      return cb(new AppError('Only PDF, DOC, DOCX, or TXT files are allowed', 400, 'DISALLOWED_FILE'));
    }
    cb(null, true);
  },
});

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'MISSING_FILE');
    validateFileType(req.file.buffer, ALLOWED_EXTS, 'resume');
    const label = cleanPlain(str(req.body, 'label', { min: 1, max: 200, optional: true }) || req.file.originalname);
    const isMaster = req.body?.isMaster === 'true' || req.body?.isMaster === true;
    // Master resumes are internal ATS base documents — hidden from the public site by default.
    const showOnSite = isMaster ? false : req.body?.showOnSite !== 'false';
    const rand = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `resume-${Date.now()}-${rand}${ext}`;
    const uploadDir = ensureUploadsDir();
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    // Exactly one master resume at a time.
    if (isMaster) await Resume.updateMany({ isMaster: true }, { $set: { isMaster: false } });
    const item = await Resume.create({ label, fileUrl: '/uploads/' + filename, isMaster, showOnSite });
    res.status(201).json(item);
  })
);

router.put(
  '/:id',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!isPathSafe(req.params.id)) {
      throw new AppError('Invalid id', 400, 'INVALID_ID');
    }
    const update = {};
    if (req.body.label !== undefined) {
      update.label = cleanPlain(str(req.body, 'label', { min: 1, max: 200 }));
    }
    if (req.body.showOnSite !== undefined) {
      update.showOnSite = req.body.showOnSite === 'true' || req.body.showOnSite === true;
    }
    if (req.file) {
      validateFileType(req.file.buffer, ALLOWED_EXTS, 'resume');
      const rand = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(req.file.originalname).toLowerCase();
      const filename = `resume-${Date.now()}-${rand}${ext}`;
      const uploadDir = ensureUploadsDir();
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      // Replaced file — drop the old one from disk so the latest is the only copy.
      const existing = await Resume.findById(req.params.id).lean();
      if (existing?.fileUrl) removeStoredFile(existing.fileUrl);
      update.fileUrl = '/uploads/' + filename;
    }
    const item = await Resume.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
    res.json(item);
  })
);

router.put(
  '/:id/master',
  asyncHandler(async (req, res) => {
    if (!isPathSafe(req.params.id)) {
      throw new AppError('Invalid id', 400, 'INVALID_ID');
    }
    const item = await Resume.findById(req.params.id);
    if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
    // Exactly one master resume at a time.
    await Resume.updateMany({ isMaster: true }, { $set: { isMaster: false } });
    item.isMaster = true;
    await item.save();
    const all = await Resume.find().sort('order');
    res.json(all);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isPathSafe(req.params.id)) {
      throw new AppError('Invalid id', 400, 'INVALID_ID');
    }
    const item = await Resume.findByIdAndDelete(req.params.id);
    if (!item) throw new AppError('Not found', 404, 'NOT_FOUND');
    removeStoredFile(item.fileUrl);
    res.json({ message: 'Deleted' });
  })
);

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
  res.status(400).json({ error: err.message || 'Upload failed' });
});

module.exports = router;
