require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");

const Room = require("./models/Room");
const roomRoutes = require("./routes/roomroutes");
const aiRoutes = require("./routes/airoutes");
const compileRoutes = require("./routes/compileroutes");
const zegoRoutes = require("./routes/zegoroutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const roomUsers = {};

const saveTimeouts = {};

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/rooms", roomRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/compile", compileRoutes);
app.use("/api/zego", zegoRoutes);

// --- ALL SOCKET LOGIC MUST STAY INSIDE THIS BLOCK ---
io.on("connection", (socket) => {
  console.log("⚡ New user connected:", socket.id);


  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);

    // FIX 1: Save these to the socket so disconnect can use them
    socket.roomId = roomId;
    socket.username = username;
    
    if (!roomUsers[roomId]) roomUsers[roomId] = [];
    if (username && !roomUsers[roomId].includes(username)) {
      roomUsers[roomId].push(username);
    }

    io.to(roomId).emit("user-list-update", roomUsers[roomId]);
  }); // <-- join-room block safely ends here

  // FIX 2: Disconnect is now outside of join-room
  socket.on("disconnect", () => {
    const { roomId, username } = socket;
    
    if (roomId && username && roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter(
        (user) => user !== username,
      );
      io.to(roomId).emit("user-list-update", roomUsers[roomId]);
      
      // Clean up the room array if everyone leaves
      if (roomUsers[roomId].length === 0) {
        delete roomUsers[roomId];
      }
    }
  });

 // 1. SYNC & SAVE CODE
socket.on("code-change", async ({ roomId, code, fileName }) => {
  // Use socket.id to tell the frontend who sent the change
  socket.to(roomId).emit("code-update", { 
    code, 
    fileName, 
    sender: socket.id 
  });

  // --- Your existing Debounced Save Logic ---
  if (saveTimeouts[roomId]) clearTimeout(saveTimeouts[roomId]);

  saveTimeouts[roomId] = setTimeout(async () => {
    try {
      const room = await Room.findById(roomId);
      if (room && room.files) {
        const updatedFiles = room.files.map((f) =>
          f.name === fileName ? { ...f, content: code } : f
        );
        await Room.findByIdAndUpdate(roomId, { files: updatedFiles });
        console.log(`Auto-saved ${fileName} to DB.`);
      }
    } catch (err) {
      console.error("Database save error:", err);
    }
  }, 2000);
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

const PORT = process.env.PORT ||  10000 || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));