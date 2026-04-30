const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { PrismaClient } = require('./prisma/generated/prisma');

const sql = neon(process.env.DATABASE_URL);
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/user', async (req, res) => {
  const { id, ip_address } = req.body;
  if (!id) return res.status(400).json({ error: 'id manquant' });
  try {
    await prisma.user.create({ data: { id, ipAddress: ip_address } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  console.log('🔥 Serveur actif sur http://localhost:3000');
});