const express = require("express");
const mongoose = require("mongoose");
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
router.post("/", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const capsule = await Capsule.create({
      ...req.body,
      owner: req.user.id
    });

    res.status(201).json(capsule);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete capsule
router.delete("/:id", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const deleted = await Capsule.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Capsule not found" });
    }

    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;