const express = require("express");
const router = express.Router();
const Room = require("../models/Room"); // FIXED: Added ../ to look outside 'routes' folder

const generateMeetingId = () => {
  const s = () => Math.floor(100 + Math.random() * 900);
  return `${s()}-${s()}-${s()}`;
};

router.post("/create", async (req, res) => {
  try {
    const { password } = req.body; // Receive password from frontend

    if (!password) {
      return res
        .status(400)
        .json({ message: "Password is required to create a room" });
    }

    const customId = generateMeetingId();
    // Save the room with the password provided by the creator
    const room = new Room({
      _id: customId,
      password: password,
      files: [
        {
          name: "main.js",
          content: "// Welcome to NexCode",
          language: "javascript",
        },
      ],
    });
    await room.save();

    res.status(201).json({ roomId: room._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/join", async (req, res) => {
  try {
    const { roomId, username, password } = req.body; // Receive password for verification
    const room = await Room.findById(roomId);

    if (!room) return res.status(404).json({ message: "Room not found" });

    // VERIFICATION: Check if provided password matches the one in DB
    if (room.password !== password) {
      return res.status(401).json({ message: "Invalid room password" });
    }

    if (room.users && !room.users.includes(username)) {
      room.users.push(username);
      await room.save();
    }

    res.status(200).json({
      roomId: room._id,
      users: room.users,
      lastCode: room.lastCode,
      language: room.language,
      files: room.files,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
