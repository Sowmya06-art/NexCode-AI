const express = require("express");
const router = express.Router();
const Room = require("../models/Room"); // FIXED: Added ../ to look outside 'routes' folder

const generateMeetingId = () => {
  const s = () => Math.floor(100 + Math.random() * 900);
  return `${s()}-${s()}-${s()}`;
};

router.post("/create", async (req, res) => {
  try {
    const customId = generateMeetingId();
    const room = new Room({ _id: customId });
    await room.save();
    res.status(201).json({ roomId: room._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/join", async (req, res) => {
  try {
    const { roomId, username } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (room.users && !room.users.includes(username)) {
      room.users.push(username);
      await room.save();
    }

    res.status(200).json({
      roomId: room._id,
      users: room.users,
      lastCode: room.lastCode,
      language: room.language,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;