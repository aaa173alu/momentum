const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { body, validationResult } = require('express-validator');
const User = require("../models/user");
const auth = require("../middleware/authMiddleware");
const router = express.Router();

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// Get all users
router.get("/", async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Search users for friend picker
router.get("/search", auth, async (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ message: "Database unavailable" });
  }

  const query = String(req.query.q || "").trim();
  if (query.length < 2) {
    return res.status(400).json({ message: "Query must have at least 2 characters" });
  }

  try {
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");

    const users = await User.find(
      {
        _id: { $ne: req.user.id },
        $or: [{ name: regex }, { email: regex }],
      },
      "name email avatar"
    )
      .sort({ name: 1 })
      .limit(15);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Registro
router.post(
  "/register",
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const userExists = await User.findOne({ email });
      if (userExists) return res.status(400).json({ message: "Email exists" });

      const hashed = await bcrypt.hash(password, 10);

      const user = await User.create({ name, email, password: hashed });

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Login
router.post(
  "/login",
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    if (!isDbConnected()) {
      return res.status(503).json({ message: "Database unavailable" });
    }

    try {
      const user = await User.findOne({ email });

      if (!user) return res.status(400).json({ message: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;