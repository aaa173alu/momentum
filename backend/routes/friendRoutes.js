const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const User = require('../models/user');
const FriendRelation = require('../models/friendRelation');

const router = express.Router();

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

async function ensureNotBlocked(currentUserId, targetUserId) {
  const relation = await loadRelation(currentUserId, targetUserId);
  if (!relation) return null;

  if (relation.status === 'blocked') {
    return relation;
  }

  return relation;
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
  }
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
    const relations = await FriendRelation.find({
      status: 'accepted',
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
    })
      .sort({ updatedAt: -1 })
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

module.exports = router;
