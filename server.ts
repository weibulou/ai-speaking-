import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";

console.log("Starting DebateMaster AI Server...");
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;

const initializeFirebase = () => {
    try {
        if (getApps().length > 0) {
            db = getFirestore(getApp());
            return;
        }

        let adminApp;
        const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccountVar) {
            console.log("Initializing Firebase Admin using FIREBASE_SERVICE_ACCOUNT env var");
            const serviceAccount = JSON.parse(serviceAccountVar);
            adminApp = initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        } else if (fs.existsSync(configPath)) {
            const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`Initializing Firebase Admin using firebase-applet-config.json for project: ${firebaseConfig.projectId}`);
            adminApp = initializeApp({ 
                projectId: process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId 
            });
        } else {
            console.warn("No Firebase config found, using default credentials");
            adminApp = initializeApp();
        }

        const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
        if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
            db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
        } else {
            db = getFirestore(adminApp);
        }
        console.log("Firebase Admin initialized successfully");
    } catch (err) {
        console.error("Firebase Admin initialization error:", err);
        // Fallback to default
        try {
            if (getApps().length === 0) initializeApp();
            db = getFirestore();
        } catch (e) {
            console.error("Firebase critical failure:", e);
        }
    }
};

initializeFirebase();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

// Helper to wrap Firestore calls with timeout
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    firebaseAdmin: !!db
  });
});

app.get("/api/config-check", (req, res) => {
  res.json({
    isConfigured: !!process.env.OPENAI_API_KEY,
    databaseInitialized: !!db,
    baseUrl: process.env.OPENAI_BASE_URL || "Not Set",
    model: process.env.AI_MODEL || "Not Set",
    env: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        PROJECT_ID: (db && db.projectId) || "None"
    }
  });
});

app.get("/api/db/user/:uid", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Database not initialized" });
  const { uid } = req.params;
  try {
    const userDoc: any = await withTimeout(db.collection('users').doc(uid).get());
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(userDoc.data());
  } catch (error: any) {
    console.error(`DB Get User Error (${uid}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/db/history/:uid", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Database not initialized" });
  const { uid } = req.params;
  try {
    const snapshot: any = await withTimeout(
      db.collection('users').doc(uid).collection('history')
        .orderBy('date', 'desc')
        .limit(50)
        .get()
    );
    const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error: any) {
    console.error(`DB Get History Error (${uid}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/domestic-login", async (req, res) => {
  const { email, displayName } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  
  console.log(`>>> Login Request: ${email}`);
  const uid = Buffer.from(email.toLowerCase().trim()).toString('base64').replace(/=/g, '');
  
  if (!db) {
      console.warn("DB not initialized - sending guest session");
      return res.json({ uid, email, displayName: displayName || email.split('@')[0], isOffline: true });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const doc: any = await withTimeout(userRef.get());
    
    let userData: any;
    if (!doc.exists) {
      userData = {
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalExercises: 0,
        averageScore: 0,
        skillRadar: [
          { subject: 'Logic', A: 60, fullMark: 100 },
          { subject: 'Rhetoric', A: 50, fullMark: 100 },
          { subject: 'Evidence', A: 55, fullMark: 100 },
          { subject: 'Fluency', A: 70, fullMark: 100 },
          { subject: 'Structure', A: 55, fullMark: 100 },
        ]
      };
      await withTimeout(userRef.set(userData));
    } else {
      userData = doc.data();
    }
    res.json(userData);
  } catch (error: any) {
    console.error("Login Error:", error);
    const errMsg = (error.message || "").toLowerCase();
    
    // Auto-fallback for permissions or timeouts
    if (errMsg.includes('timeout') || errMsg.includes('permission') || errMsg.includes('insufficient')) {
        return res.json({ 
            uid, 
            email, 
            displayName: displayName || email.split('@')[0], 
            isTemporary: true,
            warning: "Cloud database connection restricted, using temporary session."
        });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/db/save-history", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  const { uid, historyItem } = req.body;
  try {
    const historyRef = db.collection('users').doc(uid).collection('history');
    const docRef = await historyRef.add({
      ...historyItem,
      serverTimestamp: FieldValue.serverTimestamp()
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
    const updateData: any = {};
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'object' && value !== null && (value as any)._type === 'increment') {
        updateData[key] = FieldValue.increment((value as any).value);
      } else {
        updateData[key] = value;
      }
    }
    await userRef.set({ ...updateData, updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ success: true });
  } catch (error: any) {
    console.error("DB Update Stats Error:", error);
    res.status(500).json({ error: error.message });
  }
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
        { role: "user", content: "Generate a single, thought-provoking, competitive debate motion/topic. Return ONLY the topic string." }
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
            { type: "image_url", image_url: { url: image } }
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

// Environment-specific listener/middleware
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  // Only use Vite middleware in local development
  if (process.env.NODE_ENV !== "production") {
    import("vite").then(({ createServer: createViteServer }) => {
        createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        }).then(vite => {
            app.use(vite.middlewares);
            app.listen(PORT, "0.0.0.0", () => {
                console.log(`Local dev server: http://0.0.0.0:${PORT}`);
            });
        });
    });
  } else {
    // Standard production server (e.g. Cloud Run)
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production server: port ${PORT}`);
    });
  }
}

export default app;
