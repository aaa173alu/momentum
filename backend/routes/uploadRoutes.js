const express = require('express');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const { upload, useS3, S3_BUCKET } = require('../config/upload');

const router = express.Router();
const DEFAULT_PRESIGN_EXPIRES = 900;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Optional AWS S3 support
let s3Client = null;
let Sharp = null;
if (useS3) {
  try {
    const {
      S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand,
    } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    s3Client = new S3Client({});
    router.locals = router.locals || {};
    router.locals.S3 = {
      PutObjectCommand, DeleteObjectCommand, GetObjectCommand, getSignedUrl,
    };
    Sharp = require('sharp');
  } catch (e) {
    // if dependencies missing, fall back to disk behavior
    s3Client = null;
  }
}

function mimeToType(mime) {
  return mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
}

function safeObjectName(name) {
  return String(name || '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function safeFolder(folder) {
  const raw = String(folder || '').trim();
  if (!raw) return '';

  return raw
    .split('/')
    .map((part) => safeObjectName(part))
    .filter(Boolean)
    .join('/');
}

function publicS3Url(bucket, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (AWS_REGION === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
  }

  return `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${encodedKey}`;
}

// Generate a presigned URL for direct S3 upload (PUT)
router.post('/media/presign-upload', auth, async (req, res) => {
  if (!useS3 || !s3Client || !S3_BUCKET) {
    return res.status(400).json({ message: 'S3 is not configured' });
  }

  const fileName = safeObjectName(req.body?.fileName || 'file');
  const mimeType = String(req.body?.mimeType || 'application/octet-stream').trim();
  const folder = safeFolder(req.body?.folder || 'uploads');

  if (!fileName) {
    return res.status(400).json({ message: 'fileName is required' });
  }

  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const key = folder ? `${folder}/${uniquePrefix}-${fileName}` : `${uniquePrefix}-${fileName}`;
  const expiresIn = Math.min(
    Number.parseInt(process.env.S3_PRESIGN_EXPIRES || `${DEFAULT_PRESIGN_EXPIRES}`, 10) || DEFAULT_PRESIGN_EXPIRES,
    3600,
  );

  try {
    const { PutObjectCommand, getSignedUrl } = router.locals.S3;
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    res.json({
      key,
      uploadUrl,
      fileUrl: publicS3Url(S3_BUCKET, key),
      expiresIn,
    });
  } catch (error) {
    console.error('S3 presign upload error', error);
    res.status(500).json({ message: 'Could not generate upload URL' });
  }
});

// Generate a presigned URL for private S3 downloads (GET)
router.get('/media/presign-download', auth, async (req, res) => {
  if (!useS3 || !s3Client || !S3_BUCKET) {
    return res.status(400).json({ message: 'S3 is not configured' });
  }

  const key = String(req.query.key || '').trim();
  if (!key) {
    return res.status(400).json({ message: 'key is required' });
  }

  const expiresIn = Math.min(
    Number.parseInt(process.env.S3_PRESIGN_EXPIRES || `${DEFAULT_PRESIGN_EXPIRES}`, 10) || DEFAULT_PRESIGN_EXPIRES,
    3600,
  );

  try {
    const { GetObjectCommand, getSignedUrl } = router.locals.S3;
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    res.json({ key, downloadUrl, expiresIn });
  } catch (error) {
    console.error('S3 presign download error', error);
    res.status(500).json({ message: 'Could not generate download URL' });
  }
});

router.post('/media', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  // If S3 enabled and client available, upload buffer
  if (useS3 && s3Client && req.file.buffer) {
    try {
      const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const key = `${uniquePrefix}-${originalName}`;

      const { PutObjectCommand } = router.locals.S3;

      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      let thumbUrl = null;
      if (req.file.mimetype.startsWith('image/') && Sharp) {
        const thumbBuffer = await Sharp(req.file.buffer).resize({ width: 400 }).jpeg({ quality: 75 }).toBuffer();
        const thumbKey = `${uniquePrefix}-thumb.jpg`;
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/jpeg',
        }));
        thumbUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${thumbKey}`;
      }

      const fileUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;

      return res.status(201).json({
        fileUrl,
        fileName: key,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: mimeToType(req.file.mimetype),
        thumbnailUrl: thumbUrl,
      });
    } catch (err) {
      console.error('S3 upload error', err);
      return res.status(500).json({ message: 'Upload failed' });
    }
  }

  // Fallback: disk storage (existing behavior)
  if (req.file.path || req.file.filename) {
    const fileName = req.file.filename || path.basename(req.file.path);
    const fileUrl = `/uploads/${fileName}`;

    return res.status(201).json({
      fileUrl,
      fileName,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      type: mimeToType(req.file.mimetype),
    });
  }

  res.status(500).json({ message: 'Unsupported upload configuration' });
});

router.delete('/media/:fileName', auth, async (req, res) => {
  const safeName = path.basename(req.params.fileName);

  if (useS3 && s3Client) {
    try {
      const { DeleteObjectCommand } = router.locals.S3;
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: safeName }));
      return res.json({ message: 'File deleted' });
    } catch (error) {
      console.error('S3 delete error', error);
      if (error.name === 'NoSuchKey') return res.status(404).json({ message: 'File not found' });
      return res.status(500).json({ message: 'Server error' });
    }
  }

  const filePath = path.join(__dirname, '..', 'uploads', safeName);

  try {
    await require('fs/promises').unlink(filePath);
    res.json({ message: 'File deleted' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'File not found' });
    }

    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
