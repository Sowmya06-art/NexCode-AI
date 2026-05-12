// Room.js

const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // The "000-000-000" ID
    name: { type: String, default: "Collaborative Session" },
    password: { type: String, required: true },
    users: [String], // Array of usernames
    language: { type: String, default: "javascript" },
    files: [
      {
        name: String,
        content: String,
        language: String,
      },
    ],
    lastCode: { type: String, default: "// Start coding here..." },
  },
  { timestamps: true },
);

// Check if model exists before creating to prevent "OverwriteModelError"
module.exports = mongoose.models.Room || mongoose.model("Room", roomSchema);
