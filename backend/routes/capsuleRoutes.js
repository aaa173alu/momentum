const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Capsule = require('../models/capsule');
const User = require('../models/user');
const FriendRelation = require('../models/friendRelation');
const InviteToken = require('../models/inviteToken');
const auth = require('../middleware/authMiddleware');
const { notifyCommentAdded, notifyCollaboratorAdded } = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();

const crypto = require('crypto');

// R2 cleanup helpers
const S3_3D_BUCKET = process.env.S3_3D_BUCKET || null;
const S3_3D_PUBLIC_URL = (process.env.S3_3D_PUBLIC_URL || '').replace(/\/$/, '');
let r2Client = null;
let DeleteObjectCommand = null;
if (S3_3D_BUCKET) {
  try {
    const sdk = require('@aws-sdk/client-s3');
    r2Client = new sdk.S3Client({
      region: process.env.S3_3D_REGION || 'auto',
      endpoint: process.env.S3_3D_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_3D_ACCESS_KEY,
        secretAccessKey: process.env.S3_3D_SECRET_KEY,
      },
    });
    DeleteObjectCommand = sdk.DeleteObjectCommand;
  } catch (e) {
    r2Client = null;
  }
}

function r2KeyFromUrl(url) {
  if (!url || !S3_3D_PUBLIC_URL) return null;
  if (!url.startsWith(S3_3D_PUBLIC_URL + '/')) return null;
  return url.slice(S3_3D_PUBLIC_URL.length + 1);
}

async function deleteFromR2(url) {
  if (!r2Client || !DeleteObjectCommand || !url) return;
  const key = r2KeyFromUrl(url);
  if (!key) return;
  if (key.startsWith('defaults/')) return;
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: S3_3D_BUCKET, Key: key }));
  } catch (e) {
    console.error('R2 delete error for key', key, e.message);
  }
}

function isDbConnected() {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  return mongoose.connection.readyState === 1;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function accessQuery(userId) {
  return {
    $or: [{ owner: userId }, { sharedWith: userId }, { 'collaborators.user': userId }],
  };
}

function ownerOnly(capsule, userId) {
  return String(capsule.owner) === String(userId);
}

function collaboratorRole(capsule, userId) {
  const collaborator = (capsule.collaborators || []).find(
    (item) => String(item.user) === String(userId),
  );

  return collaborator ? collaborator.role : null;
}

function canEdit(capsule, userId) {
  if (ownerOnly(capsule, userId)) return true;

  const role = collaboratorRole(capsule, userId);
  return role === 'admin' || role === 'edit';
}

function canManage(capsule, userId) {
  if (ownerOnly(capsule, userId)) return true;

  const role = collaboratorRole(capsule, userId);
  return role === 'admin';
}

function canModerateComments(capsule, userId) {
  return canManage(capsule, userId);
}

function normalizeRole(role) {
  if (role === 'admin' || role === 'edit' || role === 'view') return role;
  return 'view';
}

async function resolveCollaborators(entries, currentUserId) {
  const normalizedEntries = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      if (entry.userId && isValidObjectId(entry.userId)) {
        return { userId: String(entry.userId), email: null, role: normalizeRole(entry.role) };
      }

      if (entry.email && typeof entry.email === 'string') {
        return {
          userId: null,
          email: entry.email.toLowerCase().trim(),
          role: normalizeRole(entry.role),
        };
      }

      return null;
    })
    .filter(Boolean);

  if (normalizedEntries.length === 0) return [];

  const ids = normalizedEntries.map((entry) => entry.userId).filter(Boolean);
  const emails = normalizedEntries.map((entry) => entry.email).filter(Boolean);

  const users = await User.find(
    {
      $or: [
        ids.length ? { _id: { $in: ids } } : null,
        emails.length ? { email: { $in: emails } } : null,
      ].filter(Boolean),
    },
    '_id email',
  );

  const byId = new Map(users.map((user) => [String(user._id), String(user._id)]));
  const byEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), String(user._id)]));

  const resolved = new Map();

  normalizedEntries.forEach((entry) => {
    const foundId = entry.userId ? byId.get(entry.userId) : byEmail.get(entry.email);
    if (!foundId) return;
    if (foundId === String(currentUserId)) return;

    resolved.set(foundId, { user: foundId, role: entry.role });
  });

  return Array.from(resolved.values());
}

async function findAccessibleCapsule(capsuleId, userId) {
  return Capsule.findOne({ _id: capsuleId, ...accessQuery(userId) });
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback;

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
}

function sliceMediaComments(capsule, limit, offset) {
  const plainCapsule = typeof capsule.toObject === 'function' ? capsule.toObject() : JSON.parse(JSON.stringify(capsule));

  plainCapsule.mediaItems = (plainCapsule.mediaItems || []).map((media) => {
    const comments = Array.isArray(media.comments) ? media.comments : [];
    const total = comments.length;
    const slicedComments = comments.slice(offset, offset + limit);

    return {
      ...media,
      comments: slicedComments,
      commentsMeta: {
        limit,
        offset,
        total,
        hasMore: offset + slicedComments.length < total,
      },
    };
  });

  return plainCapsule;
}

function mediaLooks3D(mediaItem) {
  if (!mediaItem || typeof mediaItem !== 'object') return false;

  if (mediaItem.type === '3d') return true;

  const url = String(mediaItem.url || '');
  return /\.(glb|gltf|obj|fbx|stl)(\?.*)?$/i.test(url);
}

function resolvePrimary3DMedia(capsule) {
  const mediaItems = Array.isArray(capsule.mediaItems) ? capsule.mediaItems : [];
  return mediaItems.find((item) => item.type === '3d') || mediaItems.find(mediaLooks3D) || null;
}

async function areAcceptedFriends(userIdA, userIdB) {
  const relation = await FriendRelation.findOne({
    pairKey: [String(userIdA), String(userIdB)].sort().join(':'),
    status: 'accepted',
  });

  return Boolean(relation);
}

router.get('/common/:friendId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.friendId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const relationExists = await areAcceptedFriends(req.user.id, req.params.friendId);
    if (!relationExists) {
      return res.status(404).json({ message: 'Friendship not found' });
    }

    const capsules = await Capsule.find({
      $and: [accessQuery(req.user.id), accessQuery(req.params.friendId)],
    })
      .sort({ updatedAt: -1 })
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar')
      .populate('collaborators.user', 'name email avatar');

    res.json(capsules);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});




// Get available 3D models for capsule creation
router.get('/models', auth, async (req, res) => {
  try {
    const models = [
      {
        id: 'model-infinity+clock+sculpture+3d+model',
        nombre: 'Infinity+Clock+Sculpture+3d+Model',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/infinity+clock+sculpture+3d+model.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/infinity+clock+sculpture+3d+model.glb',
      },
      {
        id: 'model-globe with luggage 3d model',
        nombre: 'Globe With Luggage 3d Model',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/globe with luggage 3d model.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/globe with luggage 3d model.glb',
      },
      {
        id: 'model-stack of books 3d model',
        nombre: 'Stack Of Books 3d Model',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/stack of books 3d model.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/stack of books 3d model.glb',
      },
      {
        id: 'model-stylized house 3d model',
        nombre: 'Stylized House 3d Model',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/stylized house 3d model.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/stylized house 3d model.glb',
      },
      {
        id: 'model-tiny_planet_friends_3d-packaging-2922',
        nombre: 'Tiny Planet Friends 3d Packaging 2922',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/tiny_planet_friends_3d-packaging-2922.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/tiny_planet_friends_3d-packaging-2922.glb',
      },
      {
        id: 'model-palm trees hammock 3d model',
        nombre: 'Palm Trees Hammock 3d Model',
        thumbnailUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/thumbnails/palm trees hammock 3d model.png',
        modelUrl: 'https://pub-028631b9fcee42e0898f8bf691d9255f.r2.dev/defaults/models/palm trees hammock 3d model.glb',
      },
    ];

    res.json(models);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// Get capsules that the user owns or has shared access to
router.get('/', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const q = String(req.query.q || '').trim();
    const { category } = req.query;
    const timeCapsule = String(req.query.timeCapsule || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

    const limit = parsePositiveInteger(req.query.limit, 20);
    const offset = parsePositiveInteger(req.query.offset, 0);

    const mongoQuery = { ...accessQuery(req.user.id) };

    if (timeCapsule === 'unlocked') {
      mongoQuery.timeCapsule = {
        enabled: true,
        unlockAt: { $ne: null, $lte: new Date() },
      };
      mongoQuery.openedBy = { $ne: req.user.id };
    }

    if (q.length >= 2) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      mongoQuery.$and = mongoQuery.$and || [];
      mongoQuery.$and.push({ $or: [{ title: regex }, { description: regex }, { category: regex }] });
    }

    if (category) mongoQuery.category = new RegExp(`^${String(category)}$`, 'i');

    if (dateFrom || dateTo) {
      mongoQuery.date = mongoQuery.date || {};
      if (dateFrom) mongoQuery.date.$gte = dateFrom;
      if (dateTo) mongoQuery.date.$lte = dateTo;
    }

    const capsules = await Capsule.find(mongoQuery)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(Math.min(limit, 100))
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar profilePhoto')
      .populate('collaborators.user', 'name email avatar profilePhoto');

    res.json(capsules);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search capsules with filters: q (text), category, date range, location (lat,lng,radiusKm), pagination
router.get('/search', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const q = String(req.query.q || '').trim();
    const { category } = req.query;
    const timeCapsule = String(req.query.timeCapsule || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

    const limit = parsePositiveInteger(req.query.limit, 20);
    const offset = parsePositiveInteger(req.query.offset, 0);

    const mongoQuery = { ...accessQuery(req.user.id) };

    if (timeCapsule === 'unlocked') {
      mongoQuery.timeCapsule = {
        enabled: true,
        unlockAt: { $ne: null, $lte: new Date() },
      };
      mongoQuery.openedBy = { $ne: req.user.id };
    }

    if (q.length >= 2) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      mongoQuery.$and = mongoQuery.$and || [];
      mongoQuery.$and.push({ $or: [{ title: regex }, { description: regex }, { category: regex }] });
    }

    if (category) mongoQuery.category = String(category);

    if (dateFrom || dateTo) {
      mongoQuery.date = mongoQuery.date || {};
      if (dateFrom) mongoQuery.date.$gte = dateFrom;
      if (dateTo) mongoQuery.date.$lte = dateTo;
    }

    // Geolocation search (lat, lng, radiusKm)
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : null;

    let cursor;

    if (lat !== null && lng !== null && Number.isFinite(radiusKm)) {
      const maxDistance = Math.max(0, Number(radiusKm)) * 1000; // meters
      cursor = Capsule.find({
        ...mongoQuery,
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistance,
          },
        },
      });
    } else {
      cursor = Capsule.find(mongoQuery);
    }

    const capsules = await cursor
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(Math.min(limit, 100))
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar')
      .populate('collaborators.user', 'name email avatar');

    res.json(capsules);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get one capsule with access control
router.get('/:id', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid capsule id' });
  }

  try {
    let capsule = await Capsule.findOne({ _id: req.params.id, ...accessQuery(req.user.id) })
      .populate('owner', 'name username email avatar profilePhoto')
      .populate('sharedWith', 'name username email avatar profilePhoto')
      .populate('collaborators.user', 'name username email avatar profilePhoto')
      .populate('comments.author', 'name username email avatar')
      .populate('mediaItems.author', 'name username email avatar profilePhoto')
      .populate('mediaItems.comments.author', 'name username email avatar');

    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    const unlockedTimeCapsule = Boolean(
      capsule.timeCapsule?.enabled
      && capsule.timeCapsule?.unlockAt
      && new Date(capsule.timeCapsule.unlockAt) <= new Date(),
    );

    if (unlockedTimeCapsule) {
      const openedBy = (capsule.openedBy || []).map((id) => String(id));
      if (!openedBy.includes(String(req.user.id))) {
        capsule.openedBy = Array.from(new Set([...(capsule.openedBy || []), req.user.id]));
        await capsule.save();
      }
    }

    const hasCommentPagination = req.query.commentsLimit !== undefined || req.query.commentsOffset !== undefined;
    if (!hasCommentPagination) {
      return res.json(capsule);
    }

    const commentsLimit = parsePositiveInteger(req.query.commentsLimit, 20);
    const commentsOffset = parsePositiveInteger(req.query.commentsOffset, 0);

    res.json(sliceMediaComments(capsule, commentsLimit, commentsOffset));
  } catch (error) {
    console.error('Error fetching capsule:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get primary 3D model metadata for a capsule
router.get('/:id/model3d', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid capsule id' });
  }

  try {
    const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    const media3d = resolvePrimary3DMedia(capsule);
    if (!media3d) {
      return res.status(404).json({ message: '3D model not found for this capsule' });
    }

    return res.json({
      capsuleId: String(capsule._id),
      mediaId: String(media3d._id),
      type: media3d.type || '3d',
      url: media3d.url,
      modelFormat: media3d.modelFormat || '',
      fileSize: media3d.fileSize || 0,
      title: media3d.title || '',
      description: media3d.description || '',
      thumbnailUrl: media3d.thumbnailUrl || '',
      createdAt: media3d.createdAt || null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create capsule
router.post(
  '/',
  auth,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('category').optional().isString().withMessage('Category must be a string'),
    body('design.key').optional().isString().withMessage('Design key must be a string'),
    body('design.label').optional().isString().withMessage('Design label must be a string'),
    body('timeCapsule.enabled').optional().isBoolean().withMessage('timeCapsule.enabled must be boolean'),
    body('timeCapsule.unlockAt').optional({ nullable: true }).isISO8601().withMessage('Invalid unlock date'),
    body('mediaItems').optional().isArray().withMessage('mediaItems must be an array'),
    body('mediaItems.*.url').optional().isString().trim().notEmpty().withMessage('mediaItems url must be a non-empty string'),
    body('mediaItems.*.type').optional().isIn(['image', 'video', 'audio', 'file', '3d']).withMessage('Invalid mediaItems type'),
    body('mediaItems.*.modelFormat').optional().isIn(['', 'glb', 'gltf', 'obj', 'fbx', 'stl']).withMessage('Invalid model format'),
    body('mediaItems.*.fileSize').optional().isInt({ min: 0 }).withMessage('fileSize must be a positive integer'),
    body('collaborators').optional().isArray().withMessage('collaborators must be an array'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      const mediaItems = Array.isArray(req.body.mediaItems) ? req.body.mediaItems : [];
      const collaboratorsInput = Array.isArray(req.body.collaborators) ? req.body.collaborators : [];
      const collaborators = await resolveCollaborators(collaboratorsInput, req.user.id);

      const timeCapsuleEnabled = Boolean(req.body.timeCapsule?.enabled);
      const unlockAt = req.body.timeCapsule?.unlockAt ? new Date(req.body.timeCapsule.unlockAt) : null;

      if (timeCapsuleEnabled && !unlockAt) {
        return res.status(400).json({ message: 'timeCapsule.unlockAt is required when enabled' });
      }

      const sharedWith = collaborators.map((item) => item.user);

      const capsule = await Capsule.create({
        title: req.body.title,
        description: req.body.description ?? '',
        category: req.body.category ?? '',
        design: {
          key: req.body.design?.key ?? '',
          label: req.body.design?.label ?? '',
        },
        timeCapsule: {
          enabled: timeCapsuleEnabled,
          unlockAt,
        },
        owner: req.user.id,
        sharedWith,
        collaborators,
        mediaItems,

        // backward compatible payload support
        type: req.body.type ?? '',
        previewImage: req.body.previewImage ?? '',
        mediaFile: req.body.mediaFile ?? '',
        date: req.body.date ?? new Date(),
      });

      logger.info('Capsule created', { capsuleId: String(capsule._id), owner: String(req.user.id) });
      res.status(201).json(capsule);
    } catch (error) {
      logger.error('Capsule create error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Update capsule core data (owner/admin/edit)
router.patch(
  '/:id',
  auth,
  [
    body('title').optional().trim().notEmpty()
      .withMessage('Title cannot be empty'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('category').optional().isString().withMessage('Category must be a string'),
    body('timeCapsule.enabled').optional().isBoolean().withMessage('timeCapsule.enabled must be boolean'),
    body('timeCapsule.unlockAt').optional({ nullable: true }).isISO8601().withMessage('Invalid unlock date'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid capsule id' });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

      if (!canEdit(capsule, req.user.id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      if (req.body.title !== undefined) capsule.title = req.body.title;
      if (req.body.description !== undefined) capsule.description = req.body.description;
      if (req.body.category !== undefined) capsule.category = req.body.category;

      if (req.body.timeCapsule?.enabled !== undefined) {
        capsule.timeCapsule.enabled = Boolean(req.body.timeCapsule.enabled);
      }

      if (req.body.timeCapsule?.unlockAt !== undefined) {
        capsule.timeCapsule.unlockAt = req.body.timeCapsule.unlockAt
          ? new Date(req.body.timeCapsule.unlockAt)
          : null;
      }

      await capsule.save();
      res.json(capsule);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Share capsule with friends (by user ids or emails) - owner/admin
router.post('/:id/share', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid capsule id' });
  }

  const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
  const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
  const role = normalizeRole(req.body.role);

  if (userIds.length === 0 && emails.length === 0) {
    return res.status(400).json({ message: 'Provide userIds or emails' });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const validUserIds = userIds.filter((id) => isValidObjectId(id));

    const usersByIds = validUserIds.length
      ? await User.find({ _id: { $in: validUserIds } }, '_id')
      : [];

    const normalizedEmails = emails.map((email) => String(email).toLowerCase().trim()).filter(Boolean);
    const usersByEmails = normalizedEmails.length
      ? await User.find({ email: { $in: normalizedEmails } }, '_id')
      : [];

    const idsToShare = [...usersByIds, ...usersByEmails]
      .map((u) => String(u._id))
      .filter((id) => id !== String(req.user.id));

    if (idsToShare.length === 0) {
      return res.status(400).json({ message: 'No valid users to share with' });
    }

    const collaboratorMap = new Map(
      (capsule.collaborators || []).map((item) => [String(item.user), { user: String(item.user), role: item.role }]),
    );

    idsToShare.forEach((id) => {
      collaboratorMap.set(id, { user: id, role });
    });

    const oldCollaborators = new Map(
      (capsule.collaborators || []).map((item) => [String(item.user), { user: String(item.user), role: item.role }]),
    );

    capsule.collaborators = Array.from(collaboratorMap.values());
    capsule.sharedWith = Array.from(new Set(capsule.collaborators.map((item) => String(item.user))));
    await capsule.save();

    // Notify newly added or role-updated collaborators
    const newCollaborators = capsule.collaborators.filter((item) => {
      const old = oldCollaborators.get(String(item.user));
      return !old || old.role !== item.role;
    });

    await Promise.all(
      newCollaborators.map((item) => {
        if (String(item.user) !== String(req.user.id)) {
          return notifyCollaboratorAdded(item.user, req.user.id, capsule._id, item.role);
        }
        return Promise.resolve();
      }),
    );

    const populated = await Capsule.findById(capsule._id)
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar')
      .populate('collaborators.user', 'name email avatar');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate an invite token for a capsule (owner/admin)
router.post('/:id/invite', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid capsule id' });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const role = normalizeRole(req.body.role);
    const expiresInDays = Number(req.body.expiresInDays) || 7;
    const tokenValue = crypto.randomBytes(20).toString('hex');

    const invite = await InviteToken.create({
      token: tokenValue,
      capsule: capsule._id,
      role,
      createdBy: req.user.id,
      expiresAt: new Date(Date.now() + Math.max(0, expiresInDays) * 24 * 60 * 60 * 1000),
      used: false,
    });

    const publicUrlBase = (process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || 'https://momentum-frontend-xjzj.onrender.com').replace(/\/$/, '');
    const inviteUrl = publicUrlBase ? `${publicUrlBase}/invite/${invite.token}` : `/invite/${invite.token}`;

    res.json({ token: invite.token, url: inviteUrl, expiresAt: invite.expiresAt });
  } catch (error) {
    console.error('Error generating invite token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Replace collaborators (owner/admin)
router.patch(
  '/:id/collaborators',
  auth,
  [body('collaborators').isArray().withMessage('collaborators must be an array')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid capsule id' });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

      if (!canManage(capsule, req.user.id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const collaborators = await resolveCollaborators(req.body.collaborators, req.user.id);

      // Find newly added collaborators to notify them
      const oldCollaborators = new Map(
        (capsule.collaborators || []).map((item) => [String(item.user), { user: String(item.user), role: item.role }]),
      );

      const newCollaborators = collaborators.filter((item) => {
        const oldCollab = oldCollaborators.get(String(item.user));
        return !oldCollab || oldCollab.role !== item.role;
      });

      capsule.collaborators = collaborators;
      capsule.sharedWith = collaborators.map((item) => item.user);
      await capsule.save();

      // Notify newly added/updated collaborators
      await Promise.all(
        newCollaborators.map((item) => {
          if (String(item.user) !== String(req.user.id)) {
            return notifyCollaboratorAdded(item.user, req.user.id, capsule._id, item.role);
          }
          return Promise.resolve();
        }),
      );

      const populated = await Capsule.findById(capsule._id)
        .populate('owner', 'name email avatar')
        .populate('sharedWith', 'name email avatar')
        .populate('collaborators.user', 'name email avatar');

      res.json(populated);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Remove collaborator (owner/admin)
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const targetId = String(req.params.userId);
    capsule.collaborators = (capsule.collaborators || []).filter(
      (item) => String(item.user) !== targetId,
    );
    capsule.sharedWith = (capsule.sharedWith || []).filter((id) => String(id) !== targetId);
    await capsule.save();

    res.json({ message: 'Collaborator removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add media item into capsule (owner only)
router.post(
  '/:id/media',
  auth,
  [
    body('url').trim().notEmpty().withMessage('Media url is required'),
    body('type').optional().isIn(['image', 'video', 'audio', 'file', '3d']).withMessage('Invalid media type'),
    body('modelFormat').optional().isIn(['', 'glb', 'gltf', 'obj', 'fbx', 'stl']).withMessage('Invalid model format'),
    body('fileSize').optional().isInt({ min: 0 }).withMessage('fileSize must be a positive integer'),
    body('title').optional().isString().withMessage('Media title must be a string'),
    body('description').optional().isString().withMessage('Media description must be a string'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid capsule id' });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

      if (!canEdit(capsule, req.user.id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      capsule.mediaItems.push({
        author: req.user.id,
        type: req.body.type ?? 'image',
        url: req.body.url,
        modelFormat: req.body.modelFormat ?? '',
        fileSize: req.body.fileSize ?? 0,
        title: req.body.title ?? '',
        description: req.body.description ?? '',
        thumbnailUrl: req.body.thumbnailUrl ?? '',
      });

      await capsule.save();
      res.status(201).json(capsule);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Add general comment to capsule (owner or shared users)
router.post(
  '/:id/comments',
  auth,
  [
    body('text').trim().notEmpty().withMessage('Comment text is required'),
    body('replyTo').optional().isMongoId().withMessage('replyTo must be a valid comment id'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    try {
      const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
      if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

      let replyTarget = null;
      if (req.body.replyTo) {
        replyTarget = capsule.comments.id(req.body.replyTo);
        if (!replyTarget) {
          return res.status(404).json({ message: 'Reply target not found' });
        }
      }

      capsule.comments.push({
        author: req.user.id,
        text: req.body.text,
        replyTo: replyTarget?._id ?? null,
      });

      await capsule.save();

      const newComment = capsule.comments[capsule.comments.length - 1];
      const recipient = replyTarget?.author || capsule.owner;

      // Notify capsule owner or the replied comment author
      if (String(recipient) !== String(req.user.id)) {
        await notifyCommentAdded(recipient, req.user.id, capsule._id, newComment._id);
      }

      const populated = await Capsule.findById(capsule._id)
        .populate('owner', 'name email avatar')
        .populate('sharedWith', 'name email avatar')
        .populate('collaborators.user', 'name email avatar')
        .populate('comments.author', 'name username email avatar')
        .populate('mediaItems.comments.author', 'name username email avatar');

      res.status(201).json(populated);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Add comment to a media item (owner or shared users)
router.post(
  '/:id/media/:mediaId/comments',
  auth,
  [body('text').trim().notEmpty().withMessage('Comment text is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.mediaId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    try {
      const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
      if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

      const media = capsule.mediaItems.id(req.params.mediaId);
      if (!media) return res.status(404).json({ message: 'Media item not found' });

      media.comments.push({
        author: req.user.id,
        text: req.body.text,
      });

      await capsule.save();

      // Notify capsule owner about the new comment
      if (String(capsule.owner) !== String(req.user.id)) {
        const newComment = media.comments[media.comments.length - 1];
        await notifyCommentAdded(capsule.owner, req.user.id, capsule._id, newComment._id);
      }

      const populated = await Capsule.findById(capsule._id)
        .populate('mediaItems.comments.author', 'name username email avatar');

      res.status(201).json(populated);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Delete a media item (owner/admin/edit)
router.delete('/:id/media/:mediaId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.mediaId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    if (!canEdit(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const mediaItem = capsule.mediaItems.id(req.params.mediaId);
    if (!mediaItem) return res.status(404).json({ message: 'Media item not found' });

    const urlToDelete = mediaItem.url;
    const thumbToDelete = mediaItem.thumbnailUrl;

    mediaItem.deleteOne();
    await capsule.save();

    // Clean up R2 after DB save
    Promise.allSettled([deleteFromR2(urlToDelete), deleteFromR2(thumbToDelete)]).catch(() => { });

    res.json({ message: 'Media deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a comment from a media item (comment author, owner or admin)
router.delete('/:id/media/:mediaId/comments/:commentId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.mediaId) || !isValidObjectId(req.params.commentId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  try {
    const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    const media = capsule.mediaItems.id(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Media item not found' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const isAuthor = String(comment.author) === String(req.user.id);
    if (!isAuthor && !canModerateComments(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    comment.deleteOne();
    await capsule.save();

    const populated = await Capsule.findById(capsule._id)
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar')
      .populate('collaborators.user', 'name email avatar')
      .populate('mediaItems.author', 'name email avatar profilePhoto')
      .populate('mediaItems.comments.author', 'name email avatar');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete capsule (owner/admin)
router.delete('/:id', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid capsule id' });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this capsule' });
    }

    // Delete all media files from R2 (fire-and-forget, don't block the response)
    if (capsule.mediaItems?.length) {
      const urls = [];
      for (const item of capsule.mediaItems) {
        if (item.url) urls.push(item.url);
        if (item.thumbnailUrl) urls.push(item.thumbnailUrl);
      }
      Promise.allSettled(urls.map(deleteFromR2)).catch(() => { });
    }

    await Capsule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
