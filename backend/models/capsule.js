const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    replyTo: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const mediaItemSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file', '3d'],
      default: 'image',
    },
    url: { type: String, required: true, trim: true },
    modelFormat: {
      type: String,
      enum: ['', 'glb', 'gltf', 'obj', 'fbx', 'stl'],
      default: '',
    },
    fileSize: { type: Number, default: 0 },
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    thumbnailUrl: { type: String, trim: true, default: '' },
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const collaboratorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['admin', 'edit', 'view'],
      default: 'view',
    },
  },
  { _id: true },
);

const capsuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    design: {
      key: { type: String, trim: true, default: '' },
      label: { type: String, trim: true, default: '' },
    },
    timeCapsule: {
      enabled: { type: Boolean, default: false },
      unlockAt: { type: Date, default: null },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
      label: { type: String, trim: true },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    collaborators: [collaboratorSchema],
    openedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mediaItems: [mediaItemSchema],
    comments: [commentSchema],

    // Legacy fields kept for compatibility with old payloads/UI
    type: { type: String, default: '' },
    previewImage: { type: String, default: '' },
    mediaFile: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Capsule', capsuleSchema);

// Add geospatial index for location if not already present
try {
  capsuleSchema.index({ location: '2dsphere' });
} catch (e) {
  // ignore indexing errors at import time
}
