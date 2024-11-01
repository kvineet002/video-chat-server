const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require("cors");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Replace with the URL of your React app
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 5000;
app.use(cors({ origin: ['http://localhost:3000'] }));
app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server');
});

// Socket.IO for signaling between peers
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle join room event
  socket.on('join-room', (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId) || new Set();
    
    // if (room.size >= 2) {
    //   // Notify the user that the room is full
    //   socket.emit('room-full', roomId);
    //   console.log(`Room ${roomId} is full. User ${socket.id} could not join.`);
    //   return;
    // }

    // Join the room and notify other users
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.broadcast.to(roomId).emit('user-connected', socket.id);
  });

  // Handle offer (from one peer to another)
  socket.on('offer', (roomId, offer) => {
    socket.broadcast.to(roomId).emit('receive-offer', offer);
  });

  // Handle answer (in response to an offer)
  socket.on('answer', (roomId, answer) => {
    socket.broadcast.to(roomId).emit('receive-answer', answer);
  });

  // Handle ICE candidate exchange
  socket.on('ice-candidate', (roomId, candidate) => {
    socket.broadcast.to(roomId).emit('new-ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
