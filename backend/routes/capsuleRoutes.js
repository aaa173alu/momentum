const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require('express-validator');
const Capsule = require("../models/capsule");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// Get all capsules
router.get("/", async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const capsules = await Capsule.find().populate("owner", "name email avatar");
    res.json(capsules);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create capsule
router.post(
  "/",
  auth,
  [body('title').trim().notEmpty().withMessage('Title is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const capsule = await Capsule.create({
        ...req.body,
        owner: req.user.id,
      });

      res.status(201).json(capsule);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete capsule (only owner)
router.delete("/:id", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const capsule = await Capsule.findById(req.params.id);
    if (!capsule) return res.status(404).json({ message: "Capsule not found" });

    if (String(capsule.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized to delete this capsule" });
    }

    await Capsule.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;