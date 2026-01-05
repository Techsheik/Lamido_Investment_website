/**
 * Local development server for Vercel API routes
 * Runs on port 3000 and serves the /api routes
 * The Vite dev server (port 8080) proxies /api requests to this server
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import createInvestorHandler from "./api/admin/create-investor.js";
import getInvestmentsHandler from "./api/admin/get-investments.js";
import updateInvestmentStatusHandler from "./api/admin/update-investment-status.js";
import editInvestorHandler from "./api/admin/edit-investor.js";
import deleteInvestorHandler from "./api/admin/delete-investor.js";
import getTransactionsHandler from "./api/admin/get-transactions.js";
import updateTransactionStatusHandler from "./api/admin/update-transaction-status.js";
import getUsersHandler from "./api/admin/get-users.js";
import deleteUserHandler from "./api/admin/delete-user.js";
import getStatsHandler from "./api/admin/get-stats.js";

// Load .env file manually (Node.js doesn't auto-load it)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  console.log(`📝 Reading .env from: ${envPath}`);
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  console.log(`📝 .env has ${lines.length} lines`);
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > -1) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key) {
          process.env[key] = value;
          if (key.includes("SUPABASE")) {
            console.log(`  ✓ Set ${key} = ${value.substring(0, 50)}...`);
          }
        }
      }
    }
  });
  console.log("✓ Loaded environment variables from .env");
  console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ set' : '✗ missing'}`);
  console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing'}`);
} else {
  console.warn(`⚠ .env file not found at ${envPath}`);
}

const PORT = 3000;

// Try to use express if available; otherwise fall back to a minimal http server
try {
  const expressModule = await import("express");
  const express = expressModule.default || expressModule;
  const app = express();
  app.use(express.json());

  // Log env vars on each request for debugging
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log("[req] SUPABASE_URL:", process.env.SUPABASE_URL ? "<set>" : "<missing>");
      console.log("[req] SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "<set>" : "<missing>");
    }
    next();
  });

  // Admin routes
  app.post("/api/admin/create-investor", createInvestorHandler);
  app.get("/api/admin/get-investments", getInvestmentsHandler);
  app.post("/api/admin/update-investment-status", updateInvestmentStatusHandler);
  app.post("/api/admin/edit-investor", editInvestorHandler);
  app.post("/api/admin/delete-investor", deleteInvestorHandler);
  app.get("/api/admin/get-transactions", getTransactionsHandler);
  app.post("/api/admin/update-transaction-status", updateTransactionStatusHandler);
  app.get("/api/admin/get-users", getUsersHandler);
  app.post("/api/admin/delete-user", deleteUserHandler);
  app.get("/api/admin/get-stats", getStatsHandler);

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Local API server running on http://localhost:${PORT}`);
    console.log(`   /api/admin/create-investor is available`);
    console.log(`   Vite dev server (port 8080) will proxy /api requests here`);
    console.log(`Server PID: ${process.pid}`);
    // Keep the process alive for interactive debugging
    if (typeof process.stdin.resume === 'function') process.stdin.resume();
  });
} catch (e) {
  console.warn("express not found, falling back to built-in http server:", e.message);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/admin/create-investor") {
        console.log("[req] SUPABASE_URL:", process.env.SUPABASE_URL ? "<set>" : "<missing>");
        console.log("[req] SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "<set>" : "<missing>");
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        // Provide a minimal response object compatible with the handler
        let responded = false;
        const resObj = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await createInvestorHandler(req, resObj);
          if (!responded) res.end();
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/admin/get-investments") {
        // Provide a minimal response object compatible with the handler
        let responded = false;
        const resObj = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await getInvestmentsHandler(req, resObj);
          if (!responded) res.end();
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/admin/update-investment-status") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        let responded = false;
        const resObj = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await updateInvestmentStatusHandler(req, resObj);
          if (!responded) res.end();
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/admin/edit-investor") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        let responded = false;
        const resObj = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await editInvestorHandler(req, resObj);
          if (!responded) res.end();
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/admin/delete-investor") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        let responded = false;
        const resObj = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await deleteInvestorHandler(req, resObj);
          if (!responded) res.end();
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
        return;
      }

      res.writeHead(404);
      res.end();
    } catch (err) {
      console.error("Server error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  });

  server.listen(PORT, () => {
    console.log(`🚀 Local API server running on http://localhost:${PORT} (http fallback)`);
    console.log(`   /api/admin/create-investor is available`);
    console.log(`   Vite dev server (port 8080) will proxy /api requests here`);
    console.log(`Server PID: ${process.pid}`);
    if (typeof process.stdin.resume === 'function') process.stdin.resume();
  });
}
