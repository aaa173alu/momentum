const express = require('express');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const { upload } = require('../config/upload');

const router = express.Router();

router.post('/media', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  res.status(201).json({
    fileUrl,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    type: req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
        ? 'video'
        : req.file.mimetype.startsWith('audio/')
          ? 'audio'
          : 'file',
  });
});

router.delete('/media/:fileName', auth, async (req, res) => {
  const safeName = path.basename(req.params.fileName);
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