// index.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const game = require('./game');
const helpers = require('./helpers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

// In-memory room storage: { roomId: { messages: [], gameState: {...} } }
const roomData = {};

app.use(express.static(path.resolve('./public')));

io.on('connection', (socket) => {

    socket.on('joinRoom', (data) => {
        const { roomId, name } = data || {};
        if (!roomId || !name) return socket.emit('message', 'Missing roomId or name');

        socket.join(roomId);
        socket.roomId = roomId;
        socket.name = name;
        
        if (!roomData[roomId]) roomData[roomId] = { messages: [] };
        
        roomData[roomId].socketMap = roomData[roomId].socketMap || {};
        roomData[roomId].socketMap[name] = socket.id;

        
        socket.emit('bulkMessage',roomData[roomId].messages);
        helpers.sendToRoom(io, roomData, roomId, `User ${socket.name} joined the room`);
        console.log(`User ${socket.name} joined ${roomId}`);
        
        const gs = helpers.getGameState(roomData, roomId);
        
        if (gs) {
            if (gs.playerGameStates && gs.playerGameStates[socket.name]) {
                socket.emit('gameStateUpdate', { public: gs.public, playerGameState: gs.playerGameStates[socket.name] });
                if(socket.name == gs.public.players[gs.public.turnIndex]){
                    socket.emit('playerTurn');
                }
                return;
            }
            socket.emit('message', 'Game already in progress in this room. You can watch chat.');
        }


    });


    socket.on('message', (msg) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        helpers.sendToRoom(io, roomData, roomId, `${socket.name}: ${msg}`);
    });


    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        helpers.sendToRoom(io, roomData, roomId, `User ${socket.name} disconnected`);
        helpers.clearRoomIfEmpty(io, roomData, roomId);
    });

    socket.on('gameStart', () => {
        const roomId = socket.roomId;
        if (!roomId) return socket.emit('message', 'Not in a room');

        const room = io.sockets.adapter.rooms.get(roomId) || new Set();
        const players = [...room].map(id => {
            const s = io.sockets.sockets.get(id);
            return s && s.name ? { id, name: s.name } : null;
        }).filter(Boolean);

        if (players.length < 4) {
            socket.emit('gameStartFailed', 'Need at least 4 players to start');
            return;
        }

        const socketMap = Object.fromEntries(players.map(p => [p.name, p.id]));
        const gameState = game.initialGameState(players);
        gameState.public.stage = 'dealing'; 
        
        gameState.socketMap = socketMap;
        roomData[roomId].gameState = gameState;

        helpers.sendToRoom(io, roomData, roomId, `Game started by ${socket.name}. Dealing cards...`);

        helpers.syncGameState(io, roomId, gameState);

        setTimeout(() => {
            if (roomData[roomId] && roomData[roomId].gameState) {
                const gs = roomData[roomId].gameState;
                gs.public.stage = 'auction';
                helpers.syncGameState(io, roomId, gs);
                const bidder = game.getCurrentBidder(gs);
                helpers.sendToRoom(io, roomData, roomId, `${bidder}'s turn to bid`);
            }
        }, 3000); // 3-second delay for dealing animation
    });


    socket.on('bidPlaced', (bidAmount) => {
        const roomId = socket.roomId;
        const gs = helpers.getGameState(roomData, roomId);
        if(!helpers.validateRoomAndGameStage(socket, roomId, gs, 'auction')) return
        
        const result = game.placeBid(gs, socket.name, bidAmount);

        if(result.status === 'wrongTurn'){
            return socket.emit('message', result.messages[0]);
        }
        
        
        helpers.bulkSendToRoom(io, roomData, roomId, result.messages);
        helpers.syncGameState(io, roomId, gs);

        if (!result.auctionWon && gs.public.bidders.length > 0) {
            const next = game.getCurrentBidder(gs);
            helpers.sendToRoom(io, roomData, roomId, `${next}'s turn to bid`);
        }
    });

    socket.on('powerSuitSelected', (selectedSuit)=>{
        const roomId = socket.roomId;
        const gs = helpers.getGameState(roomData, roomId);
        if(!helpers.validateRoomAndGameStage(socket, roomId, gs, 'powerSuitSelection')) return

        const result = game.selectPowerSuit(gs, socket.name,selectedSuit);
        helpers.bulkSendToRoom(io, roomData, roomId, result.messages);
        
        helpers.syncGameState(io, roomId, gs);
    });

    socket.on('partnersSelected', (cards)=>{

        const roomId = socket.roomId;
        const gs = helpers.getGameState(roomData, roomId);
        if(!helpers.validateRoomAndGameStage(socket, roomId, gs, 'partnerSelection')) return

        const result = game.selectPartners(gs, socket.name, cards);
        
        if(result.status === 'error'){
            return socket.emit('message', result.messages[0]);
        }

        helpers.bulkSendToRoom(io, roomData, roomId, result.messages);
        
        helpers.syncGameState(io, roomId, gs);
        helpers.announcePlayerTurn(io, roomData, roomId, gs);

    });


    socket.on('cardPlayed', (card)=>{
        const roomId = socket.roomId
        const gs = helpers.getGameState(roomData, roomId);
        if(!helpers.validateRoomAndGameStage(socket, roomId, gs, 'playing')) return

        const result = game.playCard(gs, socket.name, card);
        
        if(result.status === 'error'){
            return socket.emit('message', result.messages[0]);
        }
        
        helpers.bulkSendToRoom(io, roomData, roomId, result.messages);
        
        // 1. Send the state immediately (shows the card in the slot, Sync 1)
        helpers.syncGameState(io, roomId, gs); 
        
        // 2. If the trick is complete, schedule the final, cleared state sync
        if (result.trickComplete) {
            
            // This delay MUST match the client's animation delay (3000ms in script.js)
            setTimeout(() => {
                const updatedGs = helpers.getGameState(roomData, roomId);
                if (updatedGs && updatedGs.public.stage !== 'gameOver') {
                    
                    // CRITICAL STEP: Clear round data and set new turn index now
                    const roundWinner = updatedGs.public.roundWinner;
                    
                    // Clear round state variables
                    updatedGs.public.round = [];
                    updatedGs.public.roundScore = 0;
                    updatedGs.public.turnIndex = updatedGs.public.players.indexOf(roundWinner); // Winner leads next trick
                    
                    // Clear temporary winner/score data
                    delete updatedGs.public.roundWinner;
                    delete updatedGs.public.scoreToCollect;
                    
                    // Announce turn and send the final cleared state
                    helpers.syncGameState(io, roomId, updatedGs); // Sync 2: Clears trick slot
                    helpers.announcePlayerTurn(io, roomData, roomId, updatedGs);
                } else if (updatedGs && updatedGs.public.stage === 'gameOver') {
                    // Game is over, send final score update
                    helpers.syncGameState(io, roomId, updatedGs);
                }
            }, 3500); // 3.5 seconds: 3s client animation + 0.5s buffer
            
        } else if (gs.public.stage === 'playing') {
            // Standard move: announce next turn
            helpers.announcePlayerTurn(io, roomData, roomId, gs)
        }
    });

});


// ------------------------------------------------------------
// Serve main HTML file
// ------------------------------------------------------------
app.get('/', (req, res) => {
    res.sendFile(path.resolve('./public/index.html'));
});


// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});