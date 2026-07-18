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
let lastInitializationError: string | null = null;

function extractFieldsFromText(text: string): { projectId?: string; clientEmail?: string; privateKey?: string } {
  const result: { projectId?: string; clientEmail?: string; privateKey?: string } = {};
  if (!text) return result;

  // Clean smart quotes, often pasted from mobile or different editors
  let cleaned = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Attempt JSON parsing with stripped markdown code wrappers
  try {
    let jsonStr = cleaned.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(jsonStr);
    if (parsed.project_id) result.projectId = String(parsed.project_id);
    if (parsed.client_email) result.clientEmail = String(parsed.client_email);
    if (parsed.private_key) result.privateKey = String(parsed.private_key);
    if (result.projectId || result.clientEmail || result.privateKey) {
      return result;
    }
  } catch (err) {
    // If JSON parsing fails due to trailing commas or other syntax, we proceed to regex
  }

  // Regex fallback: Extract "project_id"
  const projectRegex = /"project_id"\s*:\s*"([^"]+)"|'project_id'\s*:\s*'([^']+)'/i;
  const projectMatch = cleaned.match(projectRegex);
  if (projectMatch) {
    result.projectId = projectMatch[1] || projectMatch[2];
  }

  // Regex fallback: Extract "client_email"
  const emailRegex = /"client_email"\s*:\s*"([^"]+)"|'client_email'\s*:\s*'([^']+)'/i;
  const emailMatch = cleaned.match(emailRegex);
  if (emailMatch) {
    result.clientEmail = emailMatch[1] || emailMatch[2];
  }

  // Regex fallback: Extract "private_key"
  const privateKeyRegex = /"private_key"\s*:\s*"([\s\S]+?)"|'private_key'\s*:\s*'([\s\S]+?)'/i;
  const privateKeyMatch = cleaned.match(privateKeyRegex);
  if (privateKeyMatch) {
    result.privateKey = privateKeyMatch[1] || privateKeyMatch[2];
  }

  return result;
}

function getFirestoreDB(): Firestore | null {
  if (dbFirestore) return dbFirestore;

  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Scan ALL environment variables for any value that contains typical Firebase JSON attributes
  // This is highly robust since they might name the variable anything or paste a full JSON into an unexpected variable.
  for (const envKey of Object.keys(process.env)) {
    const val = process.env[envKey];
    if (val && (val.trim().startsWith("{") || val.includes("project_id") || val.includes("private_key") || val.includes("client_email"))) {
      const extracted = extractFieldsFromText(val);
      if (extracted.projectId) projectId = extracted.projectId;
      if (extracted.clientEmail) clientEmail = extracted.clientEmail;
      if (extracted.privateKey) privateKey = extracted.privateKey;
      console.log(`Automatically extracted and used Firebase credentials found in env var: ${envKey}`);
    }
  }

  // Load from manually saved local JSON credentials if they exist (overrides process.env)
  const credentialPaths = [
    "/tmp/firebase-credentials.json",
    path.join(process.cwd(), "firebase-credentials.json")
  ];
  for (const credPath of credentialPaths) {
    if (fs.existsSync(credPath)) {
      try {
        const fileContent = fs.readFileSync(credPath, "utf-8");
        const extracted = extractFieldsFromText(fileContent);
        if (extracted.projectId) projectId = extracted.projectId;
        if (extracted.clientEmail) clientEmail = extracted.clientEmail;
        if (extracted.privateKey) privateKey = extracted.privateKey;
        console.log(`Successfully loaded Firebase credentials from local file: ${credPath}`);
        break;
      } catch (err) {
        console.error(`Error reading credentials from ${credPath}:`, err);
      }
    }
  }

  // Helper to clean surrounding quotes and whitespace from copy-pasting
  const cleanEnvVar = (val: string | undefined): string | undefined => {
    if (!val) return undefined;
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned.trim();
  };

  projectId = cleanEnvVar(projectId);
  clientEmail = cleanEnvVar(clientEmail);
  privateKey = cleanEnvVar(privateKey);

  // Automatic repair: if clientEmail is truncated or lacks the domain, reconstruct it using the project ID
  if (clientEmail && projectId && !clientEmail.includes("@")) {
    const trimmedPrefix = clientEmail.split("@")[0].trim();
    clientEmail = `${trimmedPrefix}@${projectId}.iam.gserviceaccount.com`;
    console.log(`Automatically repaired truncated clientEmail to: ${clientEmail}`);
  }

  if (projectId && clientEmail && privateKey) {
    try {
      // Replace literal \n with real newline characters
      const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
      
      // Initialize only if not already initialized
      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
          }),
        });
      }
      dbFirestore = getFirestore();
      console.log("Firebase Admin SDK initialized successfully for Firestore.");
      lastInitializationError = null;
      return dbFirestore;
    } catch (err: any) {
      lastInitializationError = err?.message || String(err);
      console.error("Failed to initialize Firebase Admin SDK:", err);
    }
  } else {
    const missing = [];
    if (!projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
    lastInitializationError = `Missing required fields: ${missing.join(", ")}`;
    console.log(`Firebase environment variables not fully configured (missing: ${missing.join(", ")}). Falling back to local grants.json database.`);
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

// GET /api/firebase-status - returns safe diagnostic status of Firebase Database connection
app.get("/api/firebase-status", async (req, res) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  const hasLocalFile = fs.existsSync("/tmp/firebase-credentials.json") || fs.existsSync(path.join(process.cwd(), "firebase-credentials.json"));

  const hasProjectId = !!projectId && projectId.trim().length > 0;
  const hasClientEmail = !!clientEmail && clientEmail.trim().length > 0;
  const hasPrivateKey = !!privateKey && privateKey.trim().length > 0;
  const hasServiceAccountJson = !!serviceAccountJson && serviceAccountJson.trim().length > 0;

  // Scan process.env for any keys starting with FIRE or containing key/email/project
  const detectedKeys: { name: string; length: number; valuePreview: string; looksLikeJson: boolean }[] = [];
  Object.keys(process.env).forEach(key => {
    const upperKey = key.toUpperCase();
    if (upperKey.startsWith("FIRE") || upperKey.includes("PROJECT") || upperKey.includes("EMAIL") || upperKey.includes("KEY")) {
      const val = process.env[key] || "";
      let preview = "";
      if (val.length > 0) {
        preview = val.slice(0, 6) + "..." + val.slice(-6);
      }
      detectedKeys.push({
        name: key,
        length: val.length,
        valuePreview: preview,
        looksLikeJson: val.trim().startsWith("{") && val.trim().endsWith("}")
      });
    }
  });

  // Let's force an initialization attempt so we have up-to-date values
  const dbInstance = getFirestoreDB();

  // Test if we can query or if there's any active error
  let connectionTest = "untested";
  let connectionError = lastInitializationError;

  if (dbInstance) {
    try {
      // Small check to see if Firestore is actually reachable (quick limit 1 list)
      await dbInstance.collection("grants").limit(1).get();
      connectionTest = "successful";
    } catch (err: any) {
      connectionTest = "failed_query";
      connectionError = err?.message || String(err);
    }
  } else {
    connectionTest = "not_initialized";
  }

  res.json({
    connected: dbInstance !== null && connectionTest === "successful",
    connectionTest,
    error: connectionError,
    detectedKeys,
    config: {
      hasProjectId,
      projectIdLength: projectId ? projectId.trim().length : 0,
      projectIdValue: projectId ? (projectId.trim().slice(0, 5) + "..." + projectId.trim().slice(-3)) : null,
      hasClientEmail,
      clientEmailLength: clientEmail ? clientEmail.trim().length : 0,
      clientEmailValue: clientEmail ? (clientEmail.trim().slice(0, 6) + "..." + clientEmail.trim().slice(-6)) : null,
      hasPrivateKey,
      privateKeyLength: privateKey ? privateKey.trim().length : 0,
      privateKeyFormatValid: privateKey ? (privateKey.includes("-----BEGIN PRIVATE KEY-----") && privateKey.includes("-----END PRIVATE KEY-----")) : false,
      hasServiceAccountJson,
      serviceAccountJsonLength: serviceAccountJson ? serviceAccountJson.trim().length : 0,
      pastedAsFullJson: hasServiceAccountJson || (projectId && projectId.trim().startsWith("{")) || (privateKey && privateKey.trim().startsWith("{")) || (clientEmail && clientEmail.trim().startsWith("{")),
      hasLocalFile
    }
  });
});

// POST /api/save-firebase-credentials - manually paste full credentials JSON
app.post("/api/save-firebase-credentials", (req, res) => {
  const { jsonText } = req.body;
  if (!jsonText || typeof jsonText !== "string") {
    res.status(400).json({ error: "No credentials JSON text provided." });
    return;
  }

  const fields = extractFieldsFromText(jsonText);
  if (!fields.projectId || !fields.clientEmail || !fields.privateKey) {
    const missing = [];
    if (!fields.projectId) missing.push("project_id");
    if (!fields.clientEmail) missing.push("client_email");
    if (!fields.privateKey) missing.push("private_key");
    res.status(400).json({
      error: `Could not parse all required service account fields from the pasted text. Missing: ${missing.join(", ")}. Please make sure you are copy-pasting the complete downloaded JSON file.`
    });
    return;
  }

  try {
    const tmpPath = "/tmp/firebase-credentials.json";
    const localPath = path.join(process.cwd(), "firebase-credentials.json");

    const cleanJson = JSON.stringify({
      project_id: fields.projectId,
      client_email: fields.clientEmail,
      private_key: fields.privateKey
    }, null, 2);

    fs.writeFileSync(tmpPath, cleanJson, "utf-8");
    fs.writeFileSync(localPath, cleanJson, "utf-8");

    // Clear instances so we reinitialize
    dbFirestore = null;
    lastInitializationError = null;

    // Trigger test
    const testDb = getFirestoreDB();
    if (testDb) {
      res.json({ success: true, message: "Credentials saved and Firebase successfully connected!" });
    } else {
      res.status(500).json({ error: "Credentials were saved, but connection failed: " + lastInitializationError });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to write or initialize credentials: " + (err?.message || String(err)) });
  }
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
