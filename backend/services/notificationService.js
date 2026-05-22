const mongoose = require('mongoose');
const Notification = require('../models/notification');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function createNotification(recipientId, actorId, type, data = {}) {
  if (!recipientId || !actorId) return null;

  // Validate that IDs are valid ObjectIds
  if (!isValidObjectId(recipientId) || !isValidObjectId(actorId)) {
    return null;
  }

  // Don't notify user about their own actions
  if (String(recipientId) === String(actorId)) {
    return null;
  }

  try {
    const notification = await Notification.create({
      recipient: recipientId,
      actor: actorId,
      type,
      data,
      read: false,
    });

    return notification;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating notification', error.message);
    return null;
  }
}

async function notifyFriendRequest(recipientId, actorId, relationId) {
  return createNotification(recipientId, actorId, 'friend_request', {
    relationId,
  });
}

async function notifyFriendAccepted(recipientId, actorId, relationId) {
  return createNotification(recipientId, actorId, 'friend_accepted', {
    relationId,
  });
}

async function notifyCommentAdded(recipientId, actorId, capsuleId, commentId) {
  return createNotification(recipientId, actorId, 'comment_added', {
    capsuleId,
    commentId,
    message: 'commented on your capsule',
  });
}

async function notifyCollaboratorAdded(recipientId, actorId, capsuleId, role = 'view') {
  return createNotification(recipientId, actorId, 'collaborator_added', {
    capsuleId,
    role,
    message: `added you as ${role}`,
  });
}

module.exports = {
  notifyFriendRequest,
  notifyFriendAccepted,
  notifyCommentAdded,
  notifyCollaboratorAdded,
};
