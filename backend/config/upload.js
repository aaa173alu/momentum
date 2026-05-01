const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const S3_BUCKET = process.env.S3_BUCKET || null;

function fileFilter(_req, file, cb) {
  const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp3',
    'application/pdf',
    'text/plain',
    'application/octet-stream',
  ]);

  if (allowedMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new Error('Unsupported file type'));
}

let upload;
let useS3 = false;

if (S3_BUCKET) {
  // Use memory storage when uploading to S3 so we can process buffers
  const storage = multer.memoryStorage();
  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  useS3 = true;
} else {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${safeName}`);
    },
  });

  upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
}

module.exports = {
  upload,
  uploadsDir,
  useS3,
  S3_BUCKET,
};