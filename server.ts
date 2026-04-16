import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";

console.log("Starting DebateMaster AI Server...");

dotenv.config();

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin initialized with project:", firebaseConfig.projectId);
} else {
  console.warn("firebase-applet-config.json not found. Firebase Admin not initialized.");
}

const db = admin.apps.length ? admin.firestore() : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      firebaseAdmin: !!db
    });
  });

  // Proxy Firestore Writes to bypass client-side network issues
  app.post("/api/db/save-history", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const { uid, historyItem } = req.body;
    try {
      const historyRef = db.collection('users').doc(uid).collection('history');
      const docRef = await historyRef.add({
        ...historyItem,
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ id: docRef.id });
    } catch (error: any) {
      console.error("DB Save History Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/db/update-stats", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const { uid, stats } = req.body;
    try {
      const userRef = db.collection('users').doc(uid);
      
      // Convert increment values if any
      const updateData: any = {};
      for (const [key, value] of Object.entries(stats)) {
        if (typeof value === 'object' && value !== null && (value as any)._type === 'increment') {
          updateData[key] = admin.firestore.FieldValue.increment((value as any).value);
        } else {
          updateData[key] = value;
        }
      }

      await userRef.update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("DB Update Stats Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/db/save-doc", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const { collection: colName, data } = req.body;
    try {
      const colRef = db.collection(colName);
      const docRef = await colRef.add({
        ...data,
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ id: docRef.id });
    } catch (error: any) {
      console.error(`DB Save Doc (${colName}) Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/config-check", (req, res) => {
    res.json({
      isConfigured: !!process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "Not Set",
      model: process.env.AI_MODEL || "Not Set"
    });
  });

  app.post("/api/ai/analyze-speech", async (req, res) => {
    const { text, systemInstruction } = req.body;
    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      });

      res.json(JSON.parse(response.choices[0].message.content || "{}"));
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const { messages, systemInstruction } = req.body;
    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          ...messages
        ],
        stream: true,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate-topic", async (req, res) => {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-4o",
        messages: [
          { role: "user", content: "Generate a single, thought-provoking, competitive debate motion/topic suitable for high school or university students. Return ONLY the topic string." }
        ],
      });
      res.json({ topic: response.choices[0].message.content?.trim() });
    } catch (error: any) {
      console.error("AI Topic Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/analyze-visual", async (req, res) => {
    const { image, prompt } = req.body;
    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: image }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      res.json(JSON.parse(response.choices[0].message.content || "{}"));
    } catch (error: any) {
      console.error("AI Visual Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
