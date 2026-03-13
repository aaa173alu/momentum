const express = require("express");
const Capsule = require("../models/capsule");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// Get all capsules
router.get("/", async (req, res) => {
  const capsules = await Capsule.find().populate("owner");
  res.json(capsules);
});

// Create capsule
router.post("/", auth, async (req, res) => {
  const capsule = await Capsule.create({
    ...req.body,
    owner: req.user.id
  });

  res.json(capsule);
});

// Delete capsule
router.delete("/:id", auth, async (req, res) => {
  await Capsule.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;