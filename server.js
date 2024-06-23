// Import the required modules
const express = require('express'); // Express is used to create a web server
const http = require('http'); // The http module is used to create an HTTP server
const socketIo = require('socket.io'); // Socket.IO enables real-time, bidirectional communication
const cors = require('cors'); // CORS middleware to handle Cross-Origin Resource Sharing

// Create an Express application
const app = express();
// Use the CORS middleware with default settings
app.use(cors());

// Create an HTTP server and attach the Express app to it
const server = http.createServer(app);
// Attach Socket.IO to the HTTP server and enable CORS
const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Object to store room data
const rooms = {};

// Handle new connections to the server
io.on('connection', async(socket) => {
    console.log('A user connected'); // Log when a user connects

    // Handle the event when a user joins a room
    socket.on('join-room', (room) => {
      console.log('User joined room', room); // Log when a user joins a room
       socket.join(room); // Make the socket join the specified room
       
        // Initialize the room if it doesn't exist
        if (!rooms[room]) {
            rooms[room] = { players: [], moves: [] };

        }
        
        
        // Check if there are less than 2 players in the room
        if (rooms[room].players.length < 2) {
            // Assign the side (white or black) based on the number of players
            const side = rooms[room].players.length === 0 ? 'white' : 'black';
            // Add the player to the room
            rooms[room].players.push({ id: socket.id, side });
            // Notify the player of their side
            socket.emit('playerSide', side);
            console.log('Player side', side); 

            // If there are now 2 players, start the game
            if (rooms[room].players.length === 2) {
                io.to(room).emit('startGame', rooms[room].players);
            }
            
        
        } else {
            // If the room already has 2 players, notify the user
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
      room.moves=[];
      io.to(roomId).emit('requestRematch');
      io.to(roomId).emit('message', 'Match Restarted');
      
    }
  });
  

    // Handle move events
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



                // Signaling for WebRTC
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

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected'); // Log when a user disconnects

        // Iterate over all rooms to find where the disconnected user was
        for (const room in rooms) {
            // Remove the player from the room
            rooms[room].players = rooms[room].players.filter(player => player.id !== socket.id);
            // If there's less than 2 players in the room now, notify the remaining player
            if (rooms[room].players.length < 2) {
                io.to(room).emit('NewRoom', 'The other player has left. please Join New Room');
            }
        }
    });
});

// Define the port to listen on
const PORT = process.env.PORT || 3001;
// Start the server and listen on the specified port
server.listen(3001,'0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`); // Log the port the server is running on
});
