const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } 
});

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || "Anonyme";
    console.log(`🔌 Nouveau socket connecté : ${socket.id} (User: ${userId})`);

    socket.on('send_message', (data) => {
        console.log(`💬 Message reçu de ${userId}: ${data.text}`);

        io.emit('receive_message', {
            text: data.text,
            sender: userId,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('disconnect', () => {
        console.log(`❌ Déconnexion de : ${socket.id}`);
    });
});

server.listen(3000, () => {
    console.log('🔥 Serveur de chat actif sur http://localhost:3000');
});