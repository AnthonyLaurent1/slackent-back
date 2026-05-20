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

// Configuration Ollama
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'; // ou 'mistral', 'gemma', etc.

// Variable globale pour stocker le ton de l'IA
let aiTone = "amical et serviable";

// Endpoint Admin pour changer le ton
app.post('/admin/tone', (req, res) => {
  const { tone, adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Clé admin invalide' });
  }

  if (!tone) return res.status(400).json({ error: 'Ton manquant' });
  
  aiTone = tone;
  console.log(`🎭 Nouveau ton de l'IA : ${aiTone}`);
  res.json({ success: true, currentTone: aiTone });
});

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

app.get('/admin/tone', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Fonction pour générer une réponse via Ollama (IA Locale)
async function getAIResponse(userMessage) {
  try {
    const prompt = `Système: Tu es un assistant intégré dans un chat d'extension navigateur. Ton ton actuel est : ${aiTone}. Réponds de manière très concise en français.
Utilisateur: ${userMessage}
Assistant:`;

    console.log("📡 Appel Ollama sur :", OLLAMA_URL);

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false
      })
    });

    console.log("📥 Status:", response.status);

    const rawText = await response.text();
    console.log("📦 Texte brut:", rawText);

    const data = JSON.parse(rawText);
    return data.response.trim();

  } catch (error) {
    console.error("Erreur Ollama:", error.message);
    return "Désolé, je n'arrive pas à joindre Ollama.";
  }
}

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || "Anonyme";
  console.log(`🔌 Nouveau socket connecté : ${socket.id} (User: ${userId})`);

  socket.on('send_message', async (data) => {
    console.log(`💬 Message reçu de ${userId}: ${data.text}`);
    
    // 1. Diffuser le message de l'utilisateur
    io.emit('receive_message', {
      text: data.text,
      sender: userId,
      timestamp: new Date().toLocaleTimeString()
    });

    // 2. Si le message mentionne "IA" ou "@ia", l'IA répond
    if (data.text.toLowerCase().includes('ia') || data.text.toLowerCase().includes('@ia')) {
      // On peut envoyer un petit message "L'IA réfléchit..." pour améliorer l'UX
      const aiResponse = await getAIResponse(data.text);
      
      io.emit('receive_message', {
        text: aiResponse,
        sender: "🤖 IA",
        timestamp: new Date().toLocaleTimeString(),
        isAI: true
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Déconnexion de : ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log('🔥 Serveur actif sur http://localhost:3000');
});
