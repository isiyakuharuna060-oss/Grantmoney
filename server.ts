import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "grants.json");

// Middleware
app.use(express.json());

// Helper to read database
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    return [];
  }
}

// Helper to write database
function writeDatabase(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing database:", err);
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
app.post("/api/grants", (req, res) => {
  const application = req.body;
  if (!application) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }

  const db = readDatabase();
  const newRecord = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...application,
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
  };

  db.push(newRecord);
  writeDatabase(db);

  res.json({ success: true, id: newRecord.id });
});

// GET /api/grants - get list of submitted grants (for admin / handling sending the grant money)
app.get("/api/grants", (req, res) => {
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
