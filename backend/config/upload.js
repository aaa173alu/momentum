const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const useR2 = Boolean(process.env.S3_3D_BUCKET);

function fileFilter(_req, file, cb) {
  // Accept any file type; classification happens later in the upload handler
  return cb(null, true);
}

let upload;

if (useR2) {
  upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 },
  });
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
  useR2,
};
