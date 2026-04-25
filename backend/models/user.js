const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePhoto: { type: String, default: "" },
  avatar: { type: String, default: "" },
  preferences: {
    theme: { type: String, enum: ["light", "dark", "system"], default: "light" },
    language: { type: String, enum: ["es", "en"], default: "es" },
    textSize: { type: String, enum: ["small", "normal", "large"], default: "normal" },
    reduceAnimations: { type: Boolean, default: false },
    emphasizeFocus: { type: Boolean, default: false },
    easyReadMode: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);