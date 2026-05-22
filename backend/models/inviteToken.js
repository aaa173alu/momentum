const mongoose = require('mongoose')

const inviteTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    capsule: { type: mongoose.Schema.Types.ObjectId, ref: 'Capsule', required: true, index: true },
    role: { type: String, enum: ['admin', 'edit', 'view'], default: 'view' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
    used: { type: Boolean, default: false },
  },
  { timestamps: true },
)

module.exports = mongoose.model('InviteToken', inviteTokenSchema)
