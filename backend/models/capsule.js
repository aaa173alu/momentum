const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const mediaItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "audio", "file"],
      default: "image",
    },
    url: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    thumbnailUrl: { type: String, trim: true, default: "" },
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const collaboratorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["admin", "edit", "view"],
      default: "view",
    },
  },
  { _id: true }
);

const capsuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    design: {
      key: { type: String, trim: true, default: "" },
      label: { type: String, trim: true, default: "" },
    },
    timeCapsule: {
      enabled: { type: Boolean, default: false },
      unlockAt: { type: Date, default: null },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
      label: { type: String, trim: true, default: '' },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    collaborators: [collaboratorSchema],
    mediaItems: [mediaItemSchema],

    // Legacy fields kept for compatibility with old payloads/UI
    type: { type: String, default: "" },
    previewImage: { type: String, default: "" },
    mediaFile: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Capsule", capsuleSchema);

// Add geospatial index for location if not already present
try {
  capsuleSchema.index({ location: '2dsphere' });
} catch (e) {
  // ignore indexing errors at import time
}