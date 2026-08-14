const fs = require('fs');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

const FILE_SIGNATURES = {
  jpeg: { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg', exts: ['jpg', 'jpeg'] },
  png: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png', exts: ['png'] },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', exts: ['gif'] },
  webp: { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', exts: ['webp'], riffType: 'WEBP' },
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', exts: ['pdf'] },
  doc: { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], mime: 'application/msword', exts: ['doc'] },
  docx: { bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', exts: ['docx'], contentMarker: 'word/' },
};

const matchesSignature = (buffer, sig) => {
  if (buffer.length < sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buffer[i] !== sig.bytes[i]) return false;
  }
  if (sig.riffType) {
    const type = buffer.slice(8, 12).toString('ascii');
    if (type !== sig.riffType) return false;
  }
  // Zip-based Office formats share the PK signature — require an internal
  // marker so a .xlsx/.zip cannot masquerade as a .docx resume.
  if (sig.contentMarker && buffer.indexOf(sig.contentMarker) === -1) return false;
  return true;
};

const detectFileType = (buffer) => {
  for (const [name, sig] of Object.entries(FILE_SIGNATURES)) {
    if (matchesSignature(buffer, sig)) return name;
  }
  return null;
};

const validateFileType = (buffer, allowedExts, label = 'file') => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    throw new AppError(`Invalid or empty ${label}`, 400, 'INVALID_FILE');
  }
  const detected = detectFileType(buffer);
  if (!detected) {
    // Plain text has no magic bytes — accept when allowed and not binary.
    if (allowedExts.includes('txt') && !buffer.subarray(0, 512).includes(0)) return 'txt';
    throw new AppError(`Unsupported ${label} type (content does not match any known format)`, 400, 'UNSUPPORTED_FILE');
  }
  const sig = FILE_SIGNATURES[detected];
  if (!sig.exts.some((e) => allowedExts.includes(e.toLowerCase()))) {
    throw new AppError(`File type "${detected}" is not allowed. Allowed: ${allowedExts.join(', ')}`, 400, 'DISALLOWED_FILE');
  }
  return detected;
};

const ensureUploadsDir = () => {
  const dir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

module.exports = {
  FILE_SIGNATURES,
  detectFileType,
  validateFileType,
  ensureUploadsDir,
};
