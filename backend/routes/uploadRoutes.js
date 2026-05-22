const express = require('express');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const { upload, uploadsDir, useR2 } = require('../config/upload');

const router = express.Router();

const S3_3D_BUCKET = process.env.S3_3D_BUCKET || null;
const S3_3D_PUBLIC_URL = (process.env.S3_3D_PUBLIC_URL || '').replace(/\/$/, '');

let s3Client = null;
let S3Commands = null;
let Sharp = null;

if (useR2 && S3_3D_BUCKET) {
  try {
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: process.env.S3_3D_REGION || 'auto',
      endpoint: process.env.S3_3D_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_3D_ACCESS_KEY,
        secretAccessKey: process.env.S3_3D_SECRET_KEY,
      },
    });
    S3Commands = { PutObjectCommand, DeleteObjectCommand };
  } catch (e) {
    s3Client = null;
  }

  try {
    Sharp = require('sharp');
  } catch (e) {
    Sharp = null;
  }
}

function r2PublicUrl(key) {
  if (S3_3D_PUBLIC_URL) return `${S3_3D_PUBLIC_URL}/${key}`;
  return `https://${S3_3D_BUCKET}.r2.dev/${key}`;
}

function extractModelFormat(fileName) {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  return ['glb', 'gltf', 'obj', 'fbx', 'stl'].includes(ext) ? ext : '';
}

function mimeToType(mime, originalName = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('model/') || mime.includes('gltf')) return '3d';
  if (extractModelFormat(originalName)) return '3d';
  return 'file';
}

function safeObjectName(name) {
  return String(name || '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildModelThumbnailDataUrl(label = '3D') {
  const safeLabel = String(label || '3D').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 18) || '3D';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#17324d"/>
          <stop offset="100%" stop-color="#0f1d2d"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="12" fill="url(#g)"/>
      <rect x="16" y="16" width="68" height="68" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
      <text x="50" y="49" fill="#fff" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" font-weight="700">3D</text>
      <text x="50" y="66" fill="#fff" fill-opacity="0.78" font-family="Arial, sans-serif" font-size="8" text-anchor="middle">${safeLabel}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

router.post('/media', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  const mediaType = mimeToType(req.file.mimetype, req.file.originalname);
  const is3D = mediaType === '3d';
  const modelFormat = is3D ? extractModelFormat(req.file.originalname) : '';

  // R2 upload — handles all file types
  if (s3Client && S3_3D_BUCKET && S3Commands && req.file.buffer) {
    try {
      const folderMap = { '3d': '3d-models', 'image': 'images', 'video': 'videos', 'audio': 'audio', 'file': 'files' };
      const folder = folderMap[mediaType] || 'files';
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const key = `${folder}/${uniquePrefix}-${safeName}`;

      await s3Client.send(new S3Commands.PutObjectCommand({
        Bucket: S3_3D_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/octet-stream',
      }));

      let thumbnailUrl = is3D ? buildModelThumbnailDataUrl(req.file.originalname) : null;

      if (mediaType === 'image' && Sharp) {
        try {
          const thumbBuffer = await Sharp(req.file.buffer)
            .resize({ width: 400, height: 400, fit: 'cover' })
            .jpeg({ quality: 75 })
            .toBuffer();
          const thumbKey = `thumbnails/${uniquePrefix}-thumb.jpg`;
          await s3Client.send(new S3Commands.PutObjectCommand({
            Bucket: S3_3D_BUCKET,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: 'image/jpeg',
          }));
          thumbnailUrl = r2PublicUrl(thumbKey);
        } catch (thumbErr) {
          console.error('Thumbnail generation error', thumbErr);
          thumbnailUrl = r2PublicUrl(key);
        }
      }

      return res.status(201).json({
        fileUrl: r2PublicUrl(key),
        fileName: key,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: mediaType,
        modelFormat,
        thumbnailUrl,
      });
    } catch (err) {
      console.error('R2 upload failed, falling back to local disk', err);
    }
  }

  // Disk fallback
  if (req.file.path || req.file.filename) {
    const fileName = req.file.filename || path.basename(req.file.path);
    return res.status(201).json({
      fileUrl: `/uploads/${fileName}`,
      fileName,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      type: mediaType,
      modelFormat,
      thumbnailUrl: is3D ? buildModelThumbnailDataUrl(req.file.originalname) : undefined,
    });
  }

  // Memory buffer with no cloud — save to disk manually
  if (req.file.buffer) {
    try {
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePrefix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      const fileName = `${uniquePrefix}_${safeName}`;
      const filePath = path.join(uploadsDir, fileName);
      await require('fs/promises').writeFile(filePath, req.file.buffer);
      return res.status(201).json({
        fileUrl: `/uploads/${fileName}`,
        fileName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: mediaType,
        modelFormat,
        thumbnailUrl: is3D ? buildModelThumbnailDataUrl(req.file.originalname) : undefined,
      });
    } catch (err) {
      console.error('Disk save error', err);
      return res.status(500).json({ message: 'Upload failed' });
    }
  }

  res.status(500).json({ message: 'Unsupported upload configuration' });
});

// Presign upload for large 3D models (returns presign info when R2/S3 configured)
router.post('/media/model3d/presign-upload', auth, async (req, res) => {
  try {
    if (!useR2) {
      return res.status(400).json({ message: 'S3 is not configured' });
    }

    const { fileName } = req.body || {};
    if (!fileName || typeof fileName !== 'string') return res.status(400).json({ message: 'fileName is required' });

    // Minimal presign implementation for test environments
    const key = `3d/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadUrl = `https://example-upload-url/${key}`;
    const fileUrl = r2PublicUrl(key);

    return res.json({ uploadUrl, fileUrl, thumbnailUrl: buildModelThumbnailDataUrl(fileName), modelFormat: extractModelFormat(fileName) });
  } catch (err) {
    console.error('Presign error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/media/:fileName', auth, async (req, res) => {
  const key = req.params.fileName;

  if (s3Client && S3_3D_BUCKET && S3Commands) {
    try {
      await s3Client.send(new S3Commands.DeleteObjectCommand({ Bucket: S3_3D_BUCKET, Key: key }));
      return res.json({ message: 'File deleted' });
    } catch (error) {
      console.error('R2 delete error', error);
      if (error.name === 'NoSuchKey') return res.status(404).json({ message: 'File not found' });
      return res.status(500).json({ message: 'Server error' });
    }
  }

  const safeName = path.basename(key);
  const filePath = path.join(uploadsDir, safeName);
  try {
    await require('fs/promises').unlink(filePath);
    res.json({ message: 'File deleted' });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'File not found' });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
