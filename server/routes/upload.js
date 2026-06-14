const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validateFileType, ensureUploadsDir } = require('../utils/fileType');

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!ALLOWED_EXTS.includes(ext)) {
      return cb(new AppError('Only image files (jpg, jpeg, png, gif, webp) are allowed', 400, 'DISALLOWED_FILE'));
    }
    cb(null, true);
  },
});

router.post(
  '/avatar',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'MISSING_FILE');

    validateFileType(req.file.buffer, ALLOWED_EXTS, 'avatar');

    const rand = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `avatar-${Date.now()}-${rand}${ext}`;
    const uploadDir = ensureUploadsDir();
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const url = '/uploads/' + filename;
    const detected = validateFileType(req.file.buffer, ALLOWED_EXTS, 'avatar');
    res.json({ url, type: detected });
  })
);

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
  res.status(400).json({ error: err.message || 'Upload failed' });
});

module.exports = router;
