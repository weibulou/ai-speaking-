import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";

console.log("Starting DebateMaster AI Server...");

dotenv.config();

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;

const initializeFirebase = () => {
    try {
        if (getApps().length > 0) return getFirestore(getApp());

        let app;
        const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccountVar) {
            console.log("Initializing Firebase Admin using FIREBASE_SERVICE_ACCOUNT env var");
            const serviceAccount = JSON.parse(serviceAccountVar);
            app = initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        } else if (fs.existsSync(configPath)) {
            const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log("Initializing Firebase Admin using firebase-applet-config.json");
            app = initializeApp({ 
                projectId: process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId 
            });
        } else {
            console.warn("No Firebase config found, using default initialization");
            app = initializeApp();
        }

        const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
        if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
            db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        } else {
            db = getFirestore(app);
        }
        console.log("Firebase Admin initialized successfully");
    } catch (err) {
        console.error("Firebase Admin initialization error:", err);
        // Last ditch fallback
        try {
            if (getApps().length === 0) initializeApp();
            db = getFirestore();
        } catch (e) {
            console.error("Firebase critical failure:", e);
        }
    }
};

initializeFirebase();

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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

// Helper to wrap Firestore calls with timeout
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T> => {
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
// NEW: Data Retrieval Endpoints for Domestic Compatibility (No VPN required for frontend)
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
  console.log(`>>> Login Request Received for: ${email}`);
  
  if (!email) return res.status(400).json({ error: "Email required" });
  
  const uid = Buffer.from(email.toLowerCase().trim()).toString('base64').replace(/=/g, '');
  
  if (!db) {
      console.warn("!!! DB not initialized, returning temp user !!!");
      return res.json({ uid, email, displayName: displayName || email.split('@')[0], isOffline: true });
  }

  try {
    console.log(`Checking Firestore for UID: ${uid}`);
    const userRef = db.collection('users').doc(uid);
    const doc: any = await withTimeout(userRef.get());
    
    let userData: any;
    if (!doc.exists) {
      console.log(`User not found, creating new profile for ${email}`);
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
      console.log(`New user profile created successfully`);
    } else {
      console.log(`User profile found`);
      userData = doc.data();
    }
    
    console.log(`Login Response Ready for ${email}`);
    res.json(userData);
  } catch (error: any) {
    console.error("!!! Domestic Login Error !!!", error);
    // Fallback: If DB is unreachable/timeouts, return a temporary user session so user isn't stuck
    const errMsg = (error.message || "").toLowerCase();
    if (errMsg.includes('timeout') || errMsg.includes('permission') || errMsg.includes('insufficient')) {
        console.warn("Returning emergency guest session due to DB issues:", error.message);
        return res.json({ 
            uid, 
            email, 
            displayName: displayName || email.split('@')[0], 
            isTemporary: true,
            warning: "Cloud database connection slow, using local session."
        });
    }
    res.status(500).json({ error: error.message });
  }
});

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
  console.log(`Attempting to save history for user: ${uid} in project ${db.projectId}`);
  try {
    const historyRef = db.collection('users').doc(uid).collection('history');
    const docRef = await historyRef.add({
      ...historyItem,
      serverTimestamp: FieldValue.serverTimestamp()
    });
    console.log(`Successfully saved history with ID: ${docRef.id}`);
    res.json({ id: docRef.id });
  } catch (error: any) {
    console.error("DB Save History Error:", error);
    res.status(500).json({ 
      error: error.message, 
      code: error.code,
      details: "This error often occurs if the project configuration is stale. Try re-running 'Set up Firebase' if you remixed this app."
    });
  }
});

app.post("/api/db/update-stats", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  const { uid, stats } = req.body;
  console.log(`Attempting to update stats for user: ${uid} in project ${db.projectId}`);
  try {
    const userRef = db.collection('users').doc(uid);
    
    // Convert increment values if any
    const updateData: any = {};
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'object' && value !== null && (value as any)._type === 'increment') {
        updateData[key] = FieldValue.increment((value as any).value);
      } else {
        updateData[key] = value;
      }
    }

    // Use set with merge: true to handle missing docs
    await userRef.set({
      ...updateData,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully set/updated stats for user: ${uid}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("DB Update Stats Error:", error);
    res.status(500).json({ 
      error: error.message, 
      code: error.code,
      details: "This error often occurs if the project configuration is stale. Try re-running 'Set up Firebase' if you remixed this app."
    });
  }
});

app.post("/api/db/save-doc", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  const { collection: colName, data } = req.body;
  try {
    const colRef = db.collection(colName);
    const docRef = await colRef.add({
      ...data,
      serverTimestamp: FieldValue.serverTimestamp()
    });
    res.json({ id: docRef.id });
  } catch (error: any) {
    console.error(`DB Save Doc (${colName}) Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/test-api", async (req, res) => {
  try {
    console.log("Testing API connection with model:", process.env.AI_MODEL);
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-4o",
      messages: [{ role: "user", content: "Hello, this is a test message to verify API connectivity." }],
    });
    res.json({ 
      success: true, 
      message: "API connection successful!",
      response: response.choices[0].message.content,
      modelUsed: response.model
    });
  } catch (error: any) {
    console.error("API Test Failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || "No additional details"
    });
  }
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

app.post("/api/ai/analyze-speech", async (req, res) => {
  const { text, systemInstruction } = req.body;
  console.log(`Analyzing speech with model: ${process.env.AI_MODEL || "gpt-4o"}`);
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
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // In Express v5, we must use *all to catch all routes for SPA
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Start listener ONLY if not in a Vercel/Serverless environment
if (process.env.VERCEL !== '1') {
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`>>> Server is successfully running and listening on 0.0.0.0:${PORT} <<<`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    });
  });
} else {
  // Always setup vite logic for SPA fallback even in serverless if needed
  setupVite();
}

export default app;
