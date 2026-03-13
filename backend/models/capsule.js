const mongoose = require("mongoose");

const capsuleSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: String,
  previewImage: String,
  mediaFile: String,
  date: Date,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

module.exports = mongoose.model("Capsule", capsuleSchema);