const express = require('express')
const mongoose = require('mongoose')
const InviteToken = require('../models/inviteToken')
const Capsule = require('../models/capsule')
const FriendRelation = require('../models/friendRelation')
const User = require('../models/user')
const auth = require('../middleware/authMiddleware')
const { notifyCollaboratorAdded } = require('../services/notificationService')

const router = express.Router()

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// Public: get invite info
router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ message: 'Invalid token' })

    const invite = await InviteToken.findOne({ token }).populate('capsule', 'title owner')
    if (!invite) return res.status(404).json({ message: 'Invite not found' })

    if (invite.used) return res.status(410).json({ message: 'Invite already used' })
    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) return res.status(410).json({ message: 'Invite expired' })

    const capsule = invite.capsule
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' })

    return res.json({ capsuleId: String(capsule._id), title: capsule.title, role: invite.role })
  } catch (err) {
    console.error('Invite GET error', err)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Accept invite - requires auth
router.post('/:token/accept', auth, async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ message: 'Invalid token' })

    const invite = await InviteToken.findOne({ token })
    if (!invite) return res.status(404).json({ message: 'Invite not found' })

    if (invite.used) return res.status(410).json({ message: 'Invite already used' })
    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) return res.status(410).json({ message: 'Invite expired' })

    const capsule = await Capsule.findById(invite.capsule)
    if (!capsule) return res.status(404).json({ message: 'Capsule not found' })

    // Add as collaborator if not present
    const userId = String(req.user.id)
    const already = (capsule.collaborators || []).some((c) => String(c.user) === userId)
    if (!already) {
      capsule.collaborators = capsule.collaborators || []
      capsule.collaborators.push({ user: userId, role: invite.role || 'view' })
      capsule.sharedWith = Array.from(new Set([...(capsule.sharedWith || []).map(String), userId]))
      await capsule.save()

      // notify
      try {
        await notifyCollaboratorAdded(userId, invite.createdBy, capsule._id, invite.role || 'view')
      } catch (e) {
        // ignore notification errors
      }
    }

    // Create accepted friend relation between capsule owner and this user
    try {
      const ownerId = String(capsule.owner)
      if (ownerId !== userId) {
        const pairKey = [ownerId, userId].sort().join(':')
        let relation = await FriendRelation.findOne({ pairKey })
        if (!relation) {
          relation = await FriendRelation.create({ requester: ownerId, recipient: userId, pairKey, status: 'accepted' })
        } else if (relation.status !== 'accepted') {
          relation.status = 'accepted'
          await relation.save()
        }
      }
    } catch (e) {
      // ignore friend creation errors
    }

    // mark invite used
    invite.used = true
    await invite.save()

    const populated = await Capsule.findById(capsule._id)
      .populate('owner', 'name email avatar')
      .populate('sharedWith', 'name email avatar')
      .populate('collaborators.user', 'name email avatar')

    return res.json(populated)
  } catch (err) {
    console.error('Invite accept error', err)
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
