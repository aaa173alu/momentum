const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const Capsule = require("../models/capsule");
const User = require("../models/user");
const auth = require("../middleware/authMiddleware");

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

function accessQuery(userId) {
  return {
    $or: [{ owner: userId }, { sharedWith: userId }, { "collaborators.user": userId }],
  };
}

function ownerOnly(capsule, userId) {
  return String(capsule.owner) === String(userId);
}

function collaboratorRole(capsule, userId) {
  const collaborator = (capsule.collaborators || []).find(
    (item) => String(item.user) === String(userId)
  );

  return collaborator ? collaborator.role : null;
}

function canEdit(capsule, userId) {
  if (ownerOnly(capsule, userId)) return true;

  const role = collaboratorRole(capsule, userId);
  return role === "admin" || role === "edit";
}

function canManage(capsule, userId) {
  if (ownerOnly(capsule, userId)) return true;

  const role = collaboratorRole(capsule, userId);
  return role === "admin";
}

function canModerateComments(capsule, userId) {
  return canManage(capsule, userId);
}

function normalizeRole(role) {
  if (role === "admin" || role === "edit" || role === "view") return role;
  return "view";
}

async function resolveCollaborators(entries, currentUserId) {
  const normalizedEntries = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      if (entry.userId && isValidObjectId(entry.userId)) {
        return { userId: String(entry.userId), email: null, role: normalizeRole(entry.role) };
      }

      if (entry.email && typeof entry.email === "string") {
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
    "_id email"
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
  const plainCapsule = typeof capsule.toObject === "function" ? capsule.toObject() : JSON.parse(JSON.stringify(capsule));

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

// Get capsules that the user owns or has shared access to
router.get("/", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const capsules = await Capsule.find(accessQuery(req.user.id))
      .sort({ updatedAt: -1 })
      .populate("owner", "name email avatar")
      .populate("sharedWith", "name email avatar")
      .populate("collaborators.user", "name email avatar");

    res.json(capsules);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get one capsule with access control
router.get("/:id", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid capsule id" });
  }

  try {
    const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    if (typeof capsule.populate === "function") {
      await capsule
        .populate("owner", "name email avatar")
        .populate("sharedWith", "name email avatar")
        .populate("collaborators.user", "name email avatar")
        .populate("mediaItems.comments.author", "name email avatar");
    }

    const hasCommentPagination = req.query.commentsLimit !== undefined || req.query.commentsOffset !== undefined;
    if (!hasCommentPagination) {
      return res.json(capsule);
    }

    const commentsLimit = parsePositiveInteger(req.query.commentsLimit, 20);
    const commentsOffset = parsePositiveInteger(req.query.commentsOffset, 0);

    res.json(sliceMediaComments(capsule, commentsLimit, commentsOffset));
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create capsule
router.post(
  "/",
  auth,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("category").optional().isString().withMessage("Category must be a string"),
    body("design.key").optional().isString().withMessage("Design key must be a string"),
    body("design.label").optional().isString().withMessage("Design label must be a string"),
    body("timeCapsule.enabled").optional().isBoolean().withMessage("timeCapsule.enabled must be boolean"),
    body("timeCapsule.unlockAt").optional({ nullable: true }).isISO8601().withMessage("Invalid unlock date"),
    body("mediaItems").optional().isArray().withMessage("mediaItems must be an array"),
    body("collaborators").optional().isArray().withMessage("collaborators must be an array"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const mediaItems = Array.isArray(req.body.mediaItems) ? req.body.mediaItems : [];
      const collaboratorsInput = Array.isArray(req.body.collaborators) ? req.body.collaborators : [];
      const collaborators = await resolveCollaborators(collaboratorsInput, req.user.id);

      const timeCapsuleEnabled = Boolean(req.body.timeCapsule?.enabled);
      const unlockAt = req.body.timeCapsule?.unlockAt ? new Date(req.body.timeCapsule.unlockAt) : null;

      if (timeCapsuleEnabled && !unlockAt) {
        return res.status(400).json({ message: "timeCapsule.unlockAt is required when enabled" });
      }

      const sharedWith = collaborators.map((item) => item.user);

      const capsule = await Capsule.create({
        title: req.body.title,
        description: req.body.description ?? "",
        category: req.body.category ?? "",
        design: {
          key: req.body.design?.key ?? "",
          label: req.body.design?.label ?? "",
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
        type: req.body.type ?? "",
        previewImage: req.body.previewImage ?? "",
        mediaFile: req.body.mediaFile ?? "",
        date: req.body.date ?? new Date(),
      });

      res.status(201).json(capsule);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update capsule core data (owner/admin/edit)
router.patch(
  "/:id",
  auth,
  [
    body("title").optional().trim().notEmpty().withMessage("Title cannot be empty"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("category").optional().isString().withMessage("Category must be a string"),
    body("timeCapsule.enabled").optional().isBoolean().withMessage("timeCapsule.enabled must be boolean"),
    body("timeCapsule.unlockAt").optional({ nullable: true }).isISO8601().withMessage("Invalid unlock date"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid capsule id" });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: "Capsule not found" });

      if (!canEdit(capsule, req.user.id)) {
        return res.status(403).json({ message: "Not authorized" });
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
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Share capsule with friends (by user ids or emails) - owner/admin
router.post("/:id/share", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid capsule id" });
  }

  const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
  const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
  const role = normalizeRole(req.body.role);

  if (userIds.length === 0 && emails.length === 0) {
    return res.status(400).json({ message: "Provide userIds or emails" });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const validUserIds = userIds.filter((id) => isValidObjectId(id));

    const usersByIds = validUserIds.length
      ? await User.find({ _id: { $in: validUserIds } }, "_id")
      : [];

    const normalizedEmails = emails.map((email) => String(email).toLowerCase().trim()).filter(Boolean);
    const usersByEmails = normalizedEmails.length
      ? await User.find({ email: { $in: normalizedEmails } }, "_id")
      : [];

    const idsToShare = [...usersByIds, ...usersByEmails]
      .map((u) => String(u._id))
      .filter((id) => id !== String(req.user.id));

    if (idsToShare.length === 0) {
      return res.status(400).json({ message: "No valid users to share with" });
    }

    const collaboratorMap = new Map(
      (capsule.collaborators || []).map((item) => [String(item.user), { user: String(item.user), role: item.role }])
    );

    idsToShare.forEach((id) => {
      collaboratorMap.set(id, { user: id, role });
    });

    capsule.collaborators = Array.from(collaboratorMap.values());
    capsule.sharedWith = Array.from(new Set(capsule.collaborators.map((item) => String(item.user))));
    await capsule.save();

    const populated = await Capsule.findById(capsule._id)
      .populate("owner", "name email avatar")
      .populate("sharedWith", "name email avatar")
      .populate("collaborators.user", "name email avatar");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Replace collaborators (owner/admin)
router.patch(
  "/:id/collaborators",
  auth,
  [body("collaborators").isArray().withMessage("collaborators must be an array")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid capsule id" });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: "Capsule not found" });

      if (!canManage(capsule, req.user.id)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const collaborators = await resolveCollaborators(req.body.collaborators, req.user.id);
      capsule.collaborators = collaborators;
      capsule.sharedWith = collaborators.map((item) => item.user);
      await capsule.save();

      const populated = await Capsule.findById(capsule._id)
        .populate("owner", "name email avatar")
        .populate("sharedWith", "name email avatar")
        .populate("collaborators.user", "name email avatar");

      res.json(populated);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Remove collaborator (owner/admin)
router.delete("/:id/collaborators/:userId", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const targetId = String(req.params.userId);
    capsule.collaborators = (capsule.collaborators || []).filter(
      (item) => String(item.user) !== targetId
    );
    capsule.sharedWith = (capsule.sharedWith || []).filter((id) => String(id) !== targetId);
    await capsule.save();

    res.json({ message: "Collaborator removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add media item into capsule (owner only)
router.post(
  "/:id/media",
  auth,
  [
    body("url").trim().notEmpty().withMessage("Media url is required"),
    body("type").optional().isIn(["image", "video", "audio", "file"]).withMessage("Invalid media type"),
    body("title").optional().isString().withMessage("Media title must be a string"),
    body("description").optional().isString().withMessage("Media description must be a string"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid capsule id" });
    }

    try {
      const capsule = await Capsule.findById(req.params.id);
      if (!capsule) return res.status(404).json({ message: "Capsule not found" });

      if (!canEdit(capsule, req.user.id)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      capsule.mediaItems.push({
        type: req.body.type ?? "image",
        url: req.body.url,
        title: req.body.title ?? "",
        description: req.body.description ?? "",
        thumbnailUrl: req.body.thumbnailUrl ?? "",
      });

      await capsule.save();
      res.status(201).json(capsule);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Add comment to a media item (owner or shared users)
router.post(
  "/:id/media/:mediaId/comments",
  auth,
  [body("text").trim().notEmpty().withMessage("Comment text is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.mediaId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    try {
      const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
      if (!capsule) return res.status(404).json({ message: "Capsule not found" });

      const media = capsule.mediaItems.id(req.params.mediaId);
      if (!media) return res.status(404).json({ message: "Media item not found" });

      media.comments.push({
        author: req.user.id,
        text: req.body.text,
      });

      await capsule.save();

      const populated = await Capsule.findById(capsule._id)
        .populate("mediaItems.comments.author", "name email avatar");

      res.status(201).json(populated);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete a comment from a media item (comment author, owner or admin)
router.delete("/:id/media/:mediaId/comments/:commentId", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.mediaId) || !isValidObjectId(req.params.commentId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  try {
    const capsule = await findAccessibleCapsule(req.params.id, req.user.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    const media = capsule.mediaItems.id(req.params.mediaId);
    if (!media) return res.status(404).json({ message: "Media item not found" });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isAuthor = String(comment.author) === String(req.user.id);
    if (!isAuthor && !canModerateComments(capsule, req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.deleteOne();
    await capsule.save();

    const populated = await Capsule.findById(capsule._id)
      .populate("owner", "name email avatar")
      .populate("sharedWith", "name email avatar")
      .populate("collaborators.user", "name email avatar")
      .populate("mediaItems.comments.author", "name email avatar");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete capsule (owner/admin)
router.delete("/:id", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid capsule id" });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    if (!canManage(capsule, req.user.id)) {
      return res.status(403).json({ message: "Not authorized to delete this capsule" });
    }

    await Capsule.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;