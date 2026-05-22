const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const FriendRelation = require('../models/friendRelation');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

function isDbConnected() {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  return mongoose.connection.readyState === 1;
}

function userResponse(user) {
  const username = String(user.name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  return {
    _id: user._id,
    name: user.name,
    username,
    email: user.email,
    profilePhoto: user.profilePhoto || user.avatar || '',
    avatar: user.avatar || user.profilePhoto || '',
    biography: user.biography || '',
    birthDate: user.birthDate || null,
    country: user.country || '',
    gender: user.gender || 'prefer_not_say',
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}

function createAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function createRefreshTokenValue() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || '';
}

function sessionResponse(session) {
  return {
    _id: session._id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    createdByIp: session.createdByIp,
    userAgent: session.userAgent,
  };
}

async function cleanupExpiredRefreshTokens() {
  await RefreshToken.deleteMany({ expiresAt: { $lte: new Date() } });
}

async function issueRefreshToken(userId, req) {
  const refreshToken = createRefreshTokenValue();
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    user: userId,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    createdByIp: String(getClientIp(req) || ''),
    userAgent: String(req.headers['user-agent'] || ''),
  });

  return refreshToken;
}

// Get all users
router.get('/', async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users for friend picker
router.get('/search', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    return res.status(400).json({ message: 'Query must have at least 2 characters' });
  }

  try {
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    const users = await User.find(
      {
        _id: { $ne: req.user.id },
        $or: [{ name: regex }, { email: regex }],
      },
      'name email avatar',
    )
      .sort({ name: 1 })
      .limit(15);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Available preferences catalog for settings screens
router.get('/preferences/options', auth, (req, res) => {
  res.json({
    theme: ['claro', 'oscuro', 'altoContraste'],
    language: ['es', 'en'],
    textSize: ['small', 'normal', 'large'],
    toggles: ['reduceAnimations', 'emphasizeFocus', 'easyReadMode'],
    defaults: {
      theme: 'claro',
      language: 'es',
      textSize: 'normal',
      reduceAnimations: false,
      emphasizeFocus: false,
      easyReadMode: false,
    },
  });
});

// Current authenticated user profile
router.get('/me', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(userResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update basic profile data
router.patch(
  '/me',
  auth,
  [
    body('name').optional().trim().notEmpty()
      .withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('profilePhoto').optional().isString().withMessage('profilePhoto must be a string'),
    body('avatar').optional().isString().withMessage('avatar must be a string'),
    body('biography').optional().isString().withMessage('biography must be a string'),
    body('birthDate').optional({ nullable: true }).isISO8601().withMessage('Invalid birthDate'),
    body('country').optional().isString().withMessage('country must be a string'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_say']).withMessage('Invalid gender'),
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
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (req.body.email && req.body.email !== user.email) {
        const exists = await User.findOne({ email: req.body.email, _id: { $ne: req.user.id } });
        if (exists) return res.status(400).json({ message: 'Email exists' });
      }

      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.email !== undefined) user.email = req.body.email;
      if (req.body.profilePhoto !== undefined) {
        user.profilePhoto = req.body.profilePhoto;
        user.avatar = req.body.profilePhoto;
      }

      if (req.body.avatar !== undefined) {
        user.avatar = req.body.avatar;
        user.profilePhoto = req.body.avatar;
      }

      if (req.body.biography !== undefined) user.biography = req.body.biography;
      if (req.body.birthDate !== undefined) user.birthDate = req.body.birthDate ? new Date(req.body.birthDate) : null;
      if (req.body.country !== undefined) user.country = req.body.country;
      if (req.body.gender !== undefined) user.gender = req.body.gender;

      await user.save();
      res.json(userResponse(user));
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Update user preferences
router.patch(
  '/me/preferences',
  auth,
  [
    body('theme').optional().isIn(['claro', 'oscuro', 'altoContraste']).withMessage('Invalid theme'),
    body('tema').optional().isIn(['claro', 'oscuro', 'altoContraste']).withMessage('Invalid theme'),
    body('language').optional().isIn(['es', 'en']).withMessage('Invalid language'),
    body('textSize').optional().isIn(['small', 'normal', 'large']).withMessage('Invalid text size'),
    body('reduceAnimations').optional().isBoolean().withMessage('reduceAnimations must be boolean'),
    body('emphasizeFocus').optional().isBoolean().withMessage('emphasizeFocus must be boolean'),
    body('easyReadMode').optional().isBoolean().withMessage('easyReadMode must be boolean'),
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
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (!user.preferences) user.preferences = {};

      if (req.body.tema !== undefined) {
        user.preferences.theme = req.body.tema;
      }

      const keys = ['theme', 'language', 'textSize', 'reduceAnimations', 'emphasizeFocus', 'easyReadMode'];
      keys.forEach((key) => {
        if (req.body[key] !== undefined) user.preferences[key] = req.body[key];
      });

      await user.save();
      res.json(userResponse(user));
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Change password
router.patch(
  '/me/password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is invalid' });

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );

      res.json({ message: 'Password updated' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Refresh access token with refresh token rotation
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('refreshToken is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      await cleanupExpiredRefreshTokens();

      const incomingToken = req.body.refreshToken;
      const incomingHash = hashToken(incomingToken);

      const tokenDoc = await RefreshToken.findOne({ tokenHash: incomingHash });
      if (!tokenDoc) return res.status(401).json({ message: 'Invalid refresh token' });

      const now = new Date();
      if (tokenDoc.revokedAt || tokenDoc.expiresAt <= now) {
        return res.status(401).json({ message: 'Refresh token expired or revoked' });
      }

      const user = await User.findById(tokenDoc.user);
      if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

      const newRefreshToken = createRefreshTokenValue();
      const newRefreshTokenHash = hashToken(newRefreshToken);

      tokenDoc.revokedAt = now;
      tokenDoc.replacedByTokenHash = newRefreshTokenHash;
      await tokenDoc.save();

      await RefreshToken.create({
        user: user._id,
        tokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdByIp: String(getClientIp(req) || ''),
        userAgent: String(req.headers['user-agent'] || ''),
      });

      const accessToken = createAccessToken(user._id);

      res.json({
        token: accessToken,
        accessToken,
        refreshToken: newRefreshToken,
        user: userResponse(user),
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Logout and revoke current refresh token
router.post('/logout', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    await cleanupExpiredRefreshTokens();

    const incomingToken = req.body?.refreshToken;

    if (incomingToken) {
      const tokenHash = hashToken(incomingToken);
      await RefreshToken.updateOne(
        { tokenHash, user: req.user.id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    } else {
      // If no refresh token is sent, revoke all active sessions for that user.
      await RefreshToken.updateMany(
        { user: req.user.id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    }

    res.json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List active sessions for current user
router.get('/sessions', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    await cleanupExpiredRefreshTokens();

    const sessions = await RefreshToken.find({
      user: req.user.id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    res.json(sessions.map(sessionResponse));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Revoke one specific session (refresh token document)
router.delete('/sessions/:sessionId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    return res.status(400).json({ message: 'Invalid session id' });
  }

  try {
    const result = await RefreshToken.updateOne(
      {
        _id: req.params.sessionId,
        user: req.user.id,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } },
    );

    if (!result.modifiedCount) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session revoked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout from all sessions
router.post('/logout-all', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    await cleanupExpiredRefreshTokens();

    await RefreshToken.updateMany(
      { user: req.user.id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    res.json({ message: 'All sessions revoked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete account
router.delete(
  '/me',
  auth,
  [body('password').notEmpty().withMessage('Password is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const valid = await bcrypt.compare(req.body.password, user.password);
      if (!valid) return res.status(400).json({ message: 'Invalid password' });

      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );

      await User.findByIdAndDelete(req.user.id);
      res.json({ message: 'Account deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Registro
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('avatar')
      .optional()
      .isString()
      .withMessage('avatar must be a string')
      .custom((value) => value.startsWith('data:image/'))
      .withMessage('avatar must be an image'),
    body('profilePhoto')
      .optional()
      .isString()
      .withMessage('profilePhoto must be a string')
      .custom((value) => value.startsWith('data:image/'))
      .withMessage('profilePhoto must be an image'),
    body('biography').optional().isString().withMessage('biography must be a string'),
    body('birthDate').optional({ nullable: true }).isISO8601().withMessage('Invalid birthDate'),
    body('country').optional().isString().withMessage('country must be a string'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_say']).withMessage('Invalid gender'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      const userExists = await User.findOne({ email });
      if (userExists) return res.status(400).json({ message: 'Email exists' });

      const hashed = await bcrypt.hash(password, 10);

      const user = await User.create({
        name,
        email,
        password: hashed,
        avatar: req.body.avatar ?? '',
        profilePhoto: req.body.profilePhoto ?? req.body.avatar ?? '',
        biography: req.body.biography ?? '',
        birthDate: req.body.birthDate ? new Date(req.body.birthDate) : null,
        country: req.body.country ?? '',
        gender: req.body.gender ?? 'prefer_not_say',
      });

      res.status(201).json(userResponse(user));
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

// Login (accept email or username)
router.post(
  '/login',
  [
    body('identifier').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { identifier, password } = req.body;

    const isEmail = String(identifier || '').includes('@');

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      await cleanupExpiredRefreshTokens();

      // Attempt lookup: email -> username field -> exact name match (case-insensitive) -> normalized name (no spaces)
      let user = null;

      if (isEmail) {
        const email = String(identifier).trim().toLowerCase();
        user = await User.findOne({ email });
      } else {
        const id = String(identifier).trim();

        // try username field if present
        user = await User.findOne({ username: id });

        // try exact name (case-insensitive)
        if (!user) {
          const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          user = await User.findOne({ name: { $regex: new RegExp(`^${safe}$`, 'i') } });
        }

        // fallback: match normalized name (lowercase, no spaces)
        if (!user) {
          const normalized = id.toLowerCase().replace(/\s+/g, '');
          // use $where to compute normalized name per document (acceptable for small userbases)
          const whereFn = `function(){ return (this.name||'').toLowerCase().replace(/\\s+/g,'') === '${normalized.replace(/'/g, "\\'")}' }`;
          user = await User.findOne({ $where: whereFn });
        }
      }

      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: 'Invalid credentials' });

      const accessToken = createAccessToken(user._id);
      const refreshToken = await issueRefreshToken(user._id, req);

      res.json({
        token: accessToken,
        accessToken,
        refreshToken,
        user: userResponse(user),
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

router.get('/:id', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalAmigos = await FriendRelation.countDocuments({
      status: 'accepted',
      $or: [{ requester: user._id }, { recipient: user._id }],
    });

    res.json({
      ...userResponse(user),
      totalAmigos,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
