const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db"); 

const Room = require("./models/Room"); // Correct for root level
const roomRoutes = require("./routes/roomroutes");
const aiRoutes = require("./routes/airoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

connectDB(); // Single connection point

app.use(cors());
app.use(express.json());

app.use("/api/rooms", roomRoutes);
app.use("/api/ai", aiRoutes);

// server.js (Node.js backend)

io.on("connection", (socket) => {
  // Joins the user to the specific room
  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
  });

  // Syncs code typing
  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-update", code);
  });

  // SYNC LANGUAGE: This is what was missing
  socket.on("language-change", ({ roomId, language }) => {
    // Sends the new language choice to everyone else in the room
    socket.to(roomId).emit("language-update", language);
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));