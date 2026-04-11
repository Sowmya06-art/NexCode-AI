const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");

const Room = require("./models/Room");
const roomRoutes = require("./routes/roomroutes");
const aiRoutes = require("./routes/airoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const roomUsers = {};

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/rooms", roomRoutes);
app.use("/api/ai", aiRoutes);

// --- ALL SOCKET LOGIC MUST STAY INSIDE THIS BLOCK ---
io.on("connection", (socket) => {
  console.log("⚡ New user connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);

    if (!roomUsers[roomId]) roomUsers[roomId] = [];
    if (username && !roomUsers[roomId].includes(username)) {
      roomUsers[roomId].push(username);
    }

    io.to(roomId).emit("user-list-update", roomUsers[roomId]);

    socket.on("disconnect", () => {
      if (roomUsers[roomId]) {
        roomUsers[roomId] = roomUsers[roomId].filter(
          (user) => user !== username,
        );
        io.to(roomId).emit("user-list-update", roomUsers[roomId]);
      }
    });
  });

  // 1. SYNC & SAVE CODE (Added fileName for multi-file support)
  socket.on("code-change", async ({ roomId, code, fileName }) => {
    // Broadcast to others in the room
    socket.to(roomId).emit("code-update", { code, fileName });

    // Save specific file content to DB
    try {
      const room = await Room.findById(roomId);
      if (room && room.files) {
        const updatedFiles = room.files.map((f) =>
          f.name === fileName ? { ...f, content: code } : f,
        );
        await Room.findByIdAndUpdate(roomId, { files: updatedFiles });
      }
    } catch (err) {
      console.error("Database save error:", err);
    }
  });

  // 2. SYNC FILE STRUCTURE (Creation, Deletion, Renaming)
  socket.on("file-structure-update", async ({ roomId, files }) => {
    socket.to(roomId).emit("file-structure-update", files);
    try {
      await Room.findByIdAndUpdate(roomId, { files: files });
    } catch (err) {
      console.error("Error saving file structure:", err);
    }
  });

  // 3. LANGUAGE SYNC
  socket.on("language-change", async ({ roomId, language }) => {
    socket.to(roomId).emit("language-update", language);
    try {
      await Room.findByIdAndUpdate(roomId, { language });
    } catch (err) {
      console.error("Language save error:", err);
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
