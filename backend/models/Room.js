const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  _id: { type: String }, // For the "000-000-000" ID
  name: { type: String, default: "Collaborative Session" },
  users: [String],
  language: { type: String, default: "javascript" },
  lastCode: { type: String, default: "// Start coding here..." }
});

// This line is where most crashes happen
module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);