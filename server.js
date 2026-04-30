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
    const userId = socket.handshake.query.userId || 'Anonyme';
    console.log(`🔌 Connecté : ${socket.id} (${userId})`);

    socket.on('send_message', (data) => {
        if (!data.text || typeof data.text !== 'string') return;

        const text = data.text.trim().slice(0, 500);
        if (!text) return;

        const now = new Date();
        const timestamp = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });

        console.log(`💬 ${userId}: ${text}`);

        io.emit('receive_message', {
            text,
            sender: userId,
            timestamp,
        });
    });

    socket.on('disconnect', () => {
        console.log(`❌ Déconnecté : ${socket.id} (${userId})`);
    });
});

server.listen(3000, () => {
    console.log('🔥 Serveur chat actif sur http://localhost:3000');
});