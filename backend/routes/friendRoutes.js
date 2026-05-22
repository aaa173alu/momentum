const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const User = require('../models/user');
const Capsule = require('../models/capsule');
const FriendRelation = require('../models/friendRelation');
const { notifyFriendRequest, notifyFriendAccepted } = require('../services/notificationService');

const router = express.Router();

function accessQuery(userId) {
  return {
    $or: [{ owner: userId }, { sharedWith: userId }, { 'collaborators.user': userId }],
  };
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

function pairKeyFor(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join(':');
}

function otherUserFromRelation(relation, currentUserId) {
  return String(relation.requester) === String(currentUserId)
    ? relation.recipient
    : relation.requester;
}

async function loadRelation(userIdA, userIdB) {
  return FriendRelation.findOne({ pairKey: pairKeyFor(userIdA, userIdB) });
}

function relationResponse(relation, currentUserId, populated = false) {
  const otherUser = otherUserFromRelation(relation, currentUserId);
  return {
    _id: relation._id,
    pairKey: relation.pairKey,
    status: relation.status,
    blockedBy: relation.blockedBy,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
    requester: populated ? relation.requester : relation.requester,
    recipient: populated ? relation.recipient : relation.recipient,
    otherUser,
  };
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

async function findUserByUsernameOrName(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const users = await User.find({}, '_id name email avatar profilePhoto');
  return users.find((user) => {
    const userName = normalizeUsername(user.name);
    const userEmail = normalizeUsername(user.email);
    return userName === normalized || userEmail === normalized;
  }) || null;
}

async function ensureNotBlocked(currentUserId, targetUserId) {
  const relation = await loadRelation(currentUserId, targetUserId);
  if (!relation) return null;

  if (relation.status === 'blocked') {
    return relation;
  }

  return relation;
}

function resolveUsername(user) {
  const name = String(user?.name || '').trim();
  if (name) {
    return name.toLowerCase().replace(/\s+/g, '.')
  }

  const email = String(user?.email || '').trim();
  if (email.includes('@')) {
    return email.split('@')[0]
  }

  return 'usuario'
}

// Send a friend request or auto-accept reciprocal pending request
router.post(
  '/requests',
  auth,
  [body('userId').notEmpty().withMessage('userId is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { userId } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    try {
      const targetUser = await User.findById(userId, '_id name email avatar profilePhoto');
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const existing = await loadRelation(req.user.id, userId);
      const reverseExisting = existing && String(existing.requester) !== String(req.user.id)
        ? existing
        : null;

      if (existing?.status === 'blocked') {
        return res.status(403).json({ message: 'This user is blocked' });
      }

      if (existing?.status === 'accepted') {
        return res.status(409).json({ message: 'You are already friends' });
      }

      if (existing?.status === 'pending' && String(existing.requester) === String(req.user.id)) {
        return res.status(409).json({ message: 'Friend request already sent' });
      }

      if (reverseExisting?.status === 'pending' && String(reverseExisting.recipient) === String(req.user.id)) {
        reverseExisting.status = 'accepted';
        await reverseExisting.save();

        // Notify the requester that their friend request was accepted
        await notifyFriendAccepted(reverseExisting.requester, req.user.id, reverseExisting._id);

        const populated = await FriendRelation.findById(reverseExisting._id)
          .populate('requester', 'name email avatar profilePhoto')
          .populate('recipient', 'name email avatar profilePhoto');

        return res.status(200).json({
          message: 'Friend request accepted automatically',
          relation: relationResponse(populated, req.user.id, true),
        });
      }

      const relation = existing || new FriendRelation({
        requester: req.user.id,
        recipient: userId,
        pairKey: pairKeyFor(req.user.id, userId),
        status: 'pending',
        blockedBy: null,
      });

      relation.requester = req.user.id;
      relation.recipient = userId;
      relation.pairKey = pairKeyFor(req.user.id, userId);
      relation.status = 'pending';
      relation.blockedBy = null;

      await relation.save();

      // Notify the recipient about the friend request
      await notifyFriendRequest(userId, req.user.id, relation._id);

      const populated = await FriendRelation.findById(relation._id)
        .populate('requester', 'name email avatar profilePhoto')
        .populate('recipient', 'name email avatar profilePhoto');

      res.status(201).json({
        message: 'Friend request sent',
        relation: relationResponse(populated, req.user.id, true),
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
);

router.post(
  '/request',
  auth,
  [body('username').notEmpty().withMessage('username is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    try {
      const targetUser = await findUserByUsernameOrName(req.body.username);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userId = String(targetUser._id);

      if (String(userId) === String(req.user.id)) {
        return res.status(400).json({ message: 'You cannot add yourself' });
      }

      const existing = await loadRelation(req.user.id, userId);
      const reverseExisting = existing && String(existing.requester) !== String(req.user.id)
        ? existing
        : null;

      if (existing?.status === 'blocked') {
        return res.status(403).json({ message: 'This user is blocked' });
      }

      if (existing?.status === 'accepted') {
        return res.status(409).json({ message: 'You are already friends' });
      }

      if (existing?.status === 'pending' && String(existing.requester) === String(req.user.id)) {
        return res.status(409).json({ message: 'Friend request already sent' });
      }

      if (reverseExisting?.status === 'pending' && String(reverseExisting.recipient) === String(req.user.id)) {
        reverseExisting.status = 'accepted';
        await reverseExisting.save();

        await notifyFriendAccepted(reverseExisting.requester, req.user.id, reverseExisting._id);

        const populated = await FriendRelation.findById(reverseExisting._id)
          .populate('requester', 'name email avatar profilePhoto')
          .populate('recipient', 'name email avatar profilePhoto');

        return res.status(200).json({
          message: 'Friend request accepted automatically',
          relation: relationResponse(populated, req.user.id, true),
        });
      }

      const relation = existing || new FriendRelation({
        requester: req.user.id,
        recipient: userId,
        pairKey: pairKeyFor(req.user.id, userId),
        status: 'pending',
        blockedBy: null,
      });

      relation.requester = req.user.id;
      relation.recipient = userId;
      relation.pairKey = pairKeyFor(req.user.id, userId);
      relation.status = 'pending';
      relation.blockedBy = null;

      await relation.save();

      await notifyFriendRequest(userId, req.user.id, relation._id);

      const populated = await FriendRelation.findById(relation._id)
        .populate('requester', 'name email avatar profilePhoto')
        .populate('recipient', 'name email avatar profilePhoto');

      return res.status(201).json({
        message: 'Friend request sent',
        relation: relationResponse(populated, req.user.id, true),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Server error' });
    }
  },
);

// Incoming friend requests
router.get('/requests/incoming', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const relations = await FriendRelation.find({
      recipient: req.user.id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json(relations.map((relation) => relationResponse(relation, req.user.id, true)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Outgoing friend requests
router.get('/requests/outgoing', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const relations = await FriendRelation.find({
      requester: req.user.id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json(relations.map((relation) => relationResponse(relation, req.user.id, true)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Accepted friends
router.get('/', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const q = String(req.query.q || '').trim();
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(0, Number(req.query.limit)) : 20;
    const offset = Number.isFinite(Number(req.query.offset)) ? Math.max(0, Number(req.query.offset)) : 0;

    const baseQuery = { status: 'accepted' };

    // If there's a q param, resolve matching users and filter by the other user
    if (q.length >= 2) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');

      const matchedUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      }, '_id');

      const ids = matchedUsers.map((u) => String(u._id));

      // Build query to match relations where the other user is in ids
      baseQuery.$or = [
        { requester: req.user.id, recipient: { $in: ids } },
        { recipient: req.user.id, requester: { $in: ids } },
      ];
    } else {
      baseQuery.$or = [{ requester: req.user.id }, { recipient: req.user.id }];
    }

    const relations = await FriendRelation.find(baseQuery)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(Math.min(limit, 100))
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json(relations.map((relation) => ({
      ...relationResponse(relation, req.user.id, true),
      friend: String(relation.requester._id) === String(req.user.id) ? relation.recipient : relation.requester,
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/shared', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const relations = await FriendRelation.find({
      status: 'accepted',
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
    })
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    const friends = relations.map((relation) => {
      const friend = String(relation.requester._id) === String(req.user.id)
        ? relation.recipient
        : relation.requester;

      return {
        _id: String(friend._id),
        name: friend.name,
        email: friend.email,
        username: resolveUsername(friend),
        avatar: friend.avatar || friend.profilePhoto || '',
      };
    });

    if (friends.length === 0) {
      return res.json([]);
    }

    const friendIds = friends.map((friend) => friend._id);

    // Find capsules that are owned by any friend and that have been shared with the current user
    const capsules = await Capsule.find({
      owner: { $in: friendIds },
      sharedWith: { $in: [String(req.user.id)] },
    })
      .sort({ updatedAt: -1 })
      .populate('owner', 'name email avatar profilePhoto')
      .populate('sharedWith', 'name email avatar profilePhoto')
      .populate('collaborators.user', 'name email avatar profilePhoto');

    const grouped = friends
      .map((friend) => {
        const sharedCapsules = capsules.filter((capsule) => {
          const ownerId = typeof capsule.owner === 'string' ? capsule.owner : String(capsule.owner?._id || '');
          return ownerId === friend._id;
        });

        return {
          ...friend,
          capsules: sharedCapsules,
        };
      })
      .filter((friend) => friend.capsules.length > 0);

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept request
router.post('/requests/:requestId/accept', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  try {
    const relation = await FriendRelation.findById(req.params.requestId);
    if (!relation) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (String(relation.recipient) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (relation.status !== 'pending') {
      return res.status(409).json({ message: 'Request cannot be accepted' });
    }

    relation.status = 'accepted';
    await relation.save();

    // Notify the requester that their friend request was accepted
    await notifyFriendAccepted(relation.requester, req.user.id, relation._id);

    const populated = await FriendRelation.findById(relation._id)
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json({
      message: 'Friend request accepted',
      relation: relationResponse(populated, req.user.id, true),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject request
router.post('/requests/:requestId/reject', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  try {
    const relation = await FriendRelation.findById(req.params.requestId);
    if (!relation) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (String(relation.recipient) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (relation.status !== 'pending') {
      return res.status(409).json({ message: 'Request cannot be rejected' });
    }

    await FriendRelation.findByIdAndDelete(relation._id);
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.delete('/:userId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const relation = await loadRelation(req.user.id, req.params.userId);
    if (!relation) {
      return res.status(404).json({ message: 'Friend relation not found' });
    }

    if (relation.status !== 'accepted') {
      return res.status(409).json({ message: 'Relation is not an accepted friendship' });
    }

    await FriendRelation.findByIdAndDelete(relation._id);
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block user
router.post('/block', auth, [body('userId').notEmpty().withMessage('userId is required')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  const { userId } = req.body;
  if (!isValidObjectId(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ message: 'You cannot block yourself' });
  }

  try {
    const targetUser = await User.findById(userId, '_id name email avatar profilePhoto');
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let relation = await loadRelation(req.user.id, userId);

    if (relation?.status === 'blocked' && String(relation.blockedBy) === String(req.user.id)) {
      return res.status(409).json({ message: 'User is already blocked' });
    }

    if (!relation) {
      relation = new FriendRelation({
        requester: req.user.id,
        recipient: userId,
        pairKey: pairKeyFor(req.user.id, userId),
      });
    }

    relation.requester = req.user.id;
    relation.recipient = userId;
    relation.pairKey = pairKeyFor(req.user.id, userId);
    relation.status = 'blocked';
    relation.blockedBy = req.user.id;
    await relation.save();

    const populated = await FriendRelation.findById(relation._id)
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json({ message: 'User blocked', relation: relationResponse(populated, req.user.id, true) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List blocked users
router.get('/blocks', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const relations = await FriendRelation.find({
      status: 'blocked',
      blockedBy: req.user.id,
    })
      .sort({ updatedAt: -1 })
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    res.json(relations.map((relation) => relationResponse(relation, req.user.id, true)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unblock user
router.delete('/blocks/:userId', auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  if (!isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const relation = await loadRelation(req.user.id, req.params.userId);
    if (!relation || relation.status !== 'blocked' || String(relation.blockedBy) !== String(req.user.id)) {
      return res.status(404).json({ message: 'Blocked user not found' });
    }

    await FriendRelation.findByIdAndDelete(relation._id);
    res.json({ message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends of a public user (no auth required)
router.get('/public/:identifier', async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  try {
    const { identifier } = req.params;
    
    // Find the user by ID or username
    let user;
    if (isValidObjectId(identifier)) {
      user = await User.findById(identifier, '_id');
    } else {
      // Search by name (username)
      const normalized = normalizeUsername(identifier);
      const users = await User.find({}, '_id name email');
      user = users.find((u) => normalizeUsername(u.name) === normalized || normalizeUsername(u.email) === normalized);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all accepted friend relations for this user
    const relations = await FriendRelation.find({
      status: 'accepted',
      $or: [
        { requester: user._id },
        { recipient: user._id },
      ],
    })
      .populate('requester', 'name email avatar profilePhoto')
      .populate('recipient', 'name email avatar profilePhoto');

    // Return the friend list with friend count
    const friends = relations.map((relation) => ({
      ...relationResponse(relation, user._id, true),
      friend: String(relation.requester._id) === String(user._id) ? relation.recipient : relation.requester,
    }));

    res.json({
      userId: user._id,
      friendCount: friends.length,
      friends,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
