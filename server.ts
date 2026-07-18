import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const app = express();
const PORT = 3000;
const DB_FILE = path.join("/tmp", "grants.json");

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// In-memory cache fallback to ensure submissions succeed even if file operations fail
let memoryCache: any[] = [];

// Lazy Firestore initialization
let dbFirestore: Firestore | null = null;

function getFirestoreDB(): Firestore | null {
  if (dbFirestore) return dbFirestore;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      // Replace literal \n with real newline characters
      privateKey = privateKey.replace(/\\n/g, "\n");
      
      // Initialize only if not already initialized
      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      dbFirestore = getFirestore();
      console.log("Firebase Admin SDK initialized successfully for Firestore.");
      return dbFirestore;
    } catch (err) {
      console.error("Failed to initialize Firebase Admin SDK:", err);
    }
  } else {
    console.log("Firebase environment variables not fully configured. Falling back to local grants.json database.");
  }
  return null;
}

// Helper to read database
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      memoryCache = parsed;
    }
    return memoryCache;
  } catch (err) {
    console.error("Error reading database from file, using memory cache fallback:", err);
    return memoryCache;
  }
}

// Helper to write database
function writeDatabase(data: any) {
  try {
    memoryCache = data;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing database to file:", err);
  }
}

// API Routes
// GET /api/ip - returns the request's IP address
app.get("/api/ip", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
  const cleanIp = ip.split(",")[0].trim();
  res.json({ ip: cleanIp });
});

// POST /api/grants - submit new grant application
app.post("/api/grants", async (req, res) => {
  const application = req.body;
  if (!application) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }

  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const rawIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
  const cleanIp = rawIp.split(",")[0].trim();

  const newRecord = {
    id,
    createdAt,
    ...application,
    ipAddress: cleanIp,
  };

  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      await firestore.collection("grants").doc(id).set(newRecord);
      console.log(`Saved record ${id} to Firebase Firestore successfully.`);
      res.json({ success: true, id });
      return;
    } catch (err) {
      console.error("Failed to write to Firebase Firestore, falling back to local database:", err);
    }
  }

  // Fallback to local file / memory cache database
  const db = readDatabase();
  db.push(newRecord);
  writeDatabase(db);

  res.json({ success: true, id });
});

// GET /api/grants - get list of submitted grants (for admin / handling sending the grant money)
app.get("/api/grants", async (req, res) => {
  const firestore = getFirestoreDB();
  if (firestore) {
    try {
      const snapshot = await firestore.collection("grants").orderBy("createdAt", "desc").get();
      const records: any[] = [];
      snapshot.forEach((doc) => {
        records.push(doc.data());
      });
      res.json(records);
      return;
    } catch (err) {
      console.error("Failed to fetch from Firebase Firestore, falling back to local database:", err);
    }
  }

  const db = readDatabase();
  res.json(db);
});

// Vite Middleware & SPA serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
