const mongoose = require('mongoose');

const friendRelationSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    pairKey: {
      type: String, required: true, unique: true, index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending',
      index: true,
    },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('FriendRelation', friendRelationSchema);
