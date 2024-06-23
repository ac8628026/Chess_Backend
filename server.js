const { Server } = require('socket.io');
const { createServer } = require('http');
const cors = require('cors');
const express = require('express');

// Initialize the Express app and use CORS middleware
const app = express();
app.use(cors());

// Create the HTTP server and attach the Express app to it
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Object to store room data
const rooms = {};

// Handle new connections to the server
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('join-room', (room) => {
    console.log('User joined room', room);
    socket.join(room);
    
    if (!rooms[room]) {
      rooms[room] = { players: [], moves: [] };
    }
    
    if (rooms[room].players.length < 2) {
      const side = rooms[room].players.length === 0 ? 'white' : 'black';
      rooms[room].players.push({ id: socket.id, side });
      socket.emit('playerSide', side);
      console.log('Player side', side);
      
      if (rooms[room].players.length === 2) {
        io.to(room).emit('startGame', rooms[room].players);
      }
    } else {
      socket.emit('roomfull', 'Room is full. Please try another room.');
    }
  });

  socket.on('gameEnd', ({ roomId, status }) => {
    console.log('Game end event received', status);
    io.to(roomId).emit('gameEnd', status);
  });

  socket.on('requestRematch', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.moves = [];
      io.to(roomId).emit('requestRematch');
      io.to(roomId).emit('message', 'Match Restarted');
    }
  });

  socket.on('move', ({ roomId, move }) => {
    try {
      if (!rooms[roomId]) {
        console.error(`Room ${roomId} not found`);
        return;
      }
      
      rooms[roomId].moves.push(move);
      socket.to(roomId).emit('move', move);
    } catch (error) {
      console.error(`Error handling move event: ${error.message}`);
    }
  });

  socket.on('offer', (data) => {
    console.log('Offer received');
    socket.to(data.room).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.room).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.room).emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    
    for (const room in rooms) {
      rooms[room].players = rooms[room].players.filter(player => player.id !== socket.id);
      if (rooms[room].players.length < 2) {
        io.to(room).emit('NewRoom', 'The other player has left. please Join New Room');
      }
    }
  });
});

// Export the server as a Vercel serverless function
module.exports = (req, res) => {
  if (!res.socket.server.io) {
    console.log('Starting Socket.IO server');
    res.socket.server.io = io;
    server.listen(3001, '0.0.0.0', () => {
      console.log(`Server running on port 3001`);
    });
  } else {
    console.log('Socket.IO server already running');
  }
  res.end();
};
