/**
 * Local development server for Vercel API routes
 * Runs on port 3000 and serves the /api routes
 * The Vite dev server (port 8080) proxies /api requests to this server
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import createInvestorHandler from "./api-lib/admin/create-investor.js";
import getInvestmentsHandler from "./api-lib/admin/get-investments.js";
import updateInvestmentStatusHandler from "./api-lib/admin/update-investment-status.js";
import editInvestorHandler from "./api-lib/admin/edit-investor.js";
import deleteInvestorHandler from "./api-lib/admin/delete-investor.js";
import getTransactionsHandler from "./api-lib/admin/get-transactions.js";
import updateTransactionStatusHandler from "./api-lib/admin/update-transaction-status.js";
import getUsersHandler from "./api-lib/admin/get-users.js";
import deleteUserHandler from "./api-lib/admin/delete-user.js";
import getStatsHandler from "./api-lib/admin/get-stats.js";
import updateUserHandler from "./api-lib/admin/update-user.js";
import bulkActivateInvestmentsHandler from "./api-lib/admin/bulk-activate-investments.js";
import getCyclesHandler from "./api-lib/admin/get-cycles.js";
import calculateCycleDistributionHandler from "./api-lib/admin/calculate-cycle-distribution.js";
import finalizeCycleDistributionHandler from "./api-lib/admin/finalize-cycle-distribution.js";
import announcementsHandler from "./api-lib/admin/announcements.js";
import complaintsHandler from "./api-lib/admin/complaints.js";
// New entry window & cycle control endpoints
import openEntryHandler from "./api-lib/admin/open-entry.js";
import closeEntryHandler from "./api-lib/admin/close-entry.js";
import startCycleHandler from "./api-lib/admin/start-cycle.js";
import resetInvestmentsHandler from "./api-lib/admin/reset-investments.js";
import getUserDetailHandler from "./api-lib/admin/get-user-detail.js";
import getPlansHandler from "./api-lib/admin/get-plans.js";
import manageAdminsHandler from "./api-lib/admin/manage-admins.js";
import createAdminHandler from "./api-lib/admin/create-admin.js";
import createUserHandler from "./api-lib/admin/create-user.js";
import deletePlanHandler from "./api-lib/admin/delete-plan.js";
import updateInvestmentHandler from "./api-lib/admin/update-investment.js";
import updatePlanHandler from "./api-lib/admin/update-plan.js";
import requestWithdrawalHandler from "./api-lib/request-withdrawal.js";
import submitComplaintHandler from "./api-lib/submit-complaint.js";
import submitReinvestmentHandler from "./api-lib/submit-reinvestment.js";
import submitPaymentProofHandler from "./api-lib/submit-payment-proof.js";
import updateProfileHandler from "./api-lib/update-profile.js";

// Load .env file manually (Node.js doesn't auto-load it)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  console.log(`📝 Reading .env from: ${envPath}`);
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > -1) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key) process.env[key] = value;
      }
    }
  });
  console.log("✓ Loaded environment variables from .env");
} else {
  console.warn(`⚠ .env file not found at ${envPath}`);
}

const PORT = 3000;
const HOST = "127.0.0.1";

// Try to use express if available; otherwise fall back to a minimal http server
try {
  const expressModule = await import("express");
  const express = expressModule.default || expressModule;
  const app = express();
  app.use(express.json());

  // Log all requests
  app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] API Request: ${req.method} ${req.path}`);
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
  app.get("/api/admin/get-user-detail", getUserDetailHandler);
  app.get("/api/admin/get-plans", getPlansHandler);
  app.all("/api/admin/manage-admins", manageAdminsHandler);
  app.post("/api/admin/create-admin", createAdminHandler);
  app.post("/api/admin/create-user", createUserHandler);
  app.post("/api/admin/delete-plan", deletePlanHandler);
  app.post("/api/admin/update-investment", updateInvestmentHandler);
  app.post("/api/admin/update-plan", updatePlanHandler);
  app.post("/api/admin/delete-user", deleteUserHandler);
  app.get("/api/admin/get-stats", getStatsHandler);
  app.post("/api/admin/update-user", updateUserHandler);
  app.post("/api/admin/bulk-activate-investments", bulkActivateInvestmentsHandler);
  app.get("/api/admin/get-cycles", getCyclesHandler);
  app.post("/api/admin/calculate-cycle-distribution", calculateCycleDistributionHandler);
  app.post("/api/admin/finalize-cycle-distribution", finalizeCycleDistributionHandler);
  
  // Announcements & Complaints routes
  app.all("/api/admin/announcements", announcementsHandler);
  app.all("/api/admin/complaints", complaintsHandler);
  // Entry window & cycle control
  app.post("/api/admin/open-entry", openEntryHandler);
  app.post("/api/admin/close-entry", closeEntryHandler);
  app.post("/api/admin/start-cycle", startCycleHandler);
  // User actions with email notification
  app.post("/api/request-withdrawal", requestWithdrawalHandler);
  app.post("/api/submit-complaint", submitComplaintHandler);
  app.post("/api/submit-reinvestment", submitReinvestmentHandler);
  app.post("/api/submit-payment-proof", submitPaymentProofHandler);
  app.post("/api/update-profile", updateProfileHandler);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", api: "available", server: "express" });
  });

  // Catch-all 404 for /api routes
  app.use("/api/*", (req, res) => {
    console.warn(`⚠ 404: Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Local API server running on http://${HOST}:${PORT}`);
    console.log(`   Vite dev server will proxy /api requests here`);
  });
} catch (e) {
  console.warn("express not found, falling back to built-in http server");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      console.log(`[${new Date().toLocaleTimeString()}] API Request: ${req.method} ${url.pathname}`);

      if (url.pathname === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", api: "available", server: "fallback" }));
        return;
      }

      // Route mapping
      const routes = {
        "GET": {
          "/api/admin/get-investments": getInvestmentsHandler,
          "/api/admin/get-transactions": getTransactionsHandler,
          "/api/admin/get-users": getUsersHandler,
          "/api/admin/get-user-detail": getUserDetailHandler,
          "/api/admin/get-plans": getPlansHandler,
          "/api/admin/get-stats": getStatsHandler,
          "/api/admin/get-cycles": getCyclesHandler,
          "/api/admin/announcements": announcementsHandler,
          "/api/admin/complaints": complaintsHandler,
        },
        "POST": {
          "/api/admin/create-investor": createInvestorHandler,
          "/api/admin/update-investment-status": updateInvestmentStatusHandler,
          "/api/admin/edit-investor": editInvestorHandler,
          "/api/admin/delete-investor": deleteInvestorHandler,
          "/api/admin/update-transaction-status": updateTransactionStatusHandler,
          "/api/admin/delete-user": deleteUserHandler,
          "/api/admin/update-user": updateUserHandler,
          "/api/admin/bulk-activate-investments": bulkActivateInvestmentsHandler,
          "/api/admin/calculate-cycle-distribution": calculateCycleDistributionHandler,
          "/api/admin/finalize-cycle-distribution": finalizeCycleDistributionHandler,
          "/api/admin/announcements": announcementsHandler,
          "/api/admin/complaints": complaintsHandler,
          "/api/admin/open-entry": openEntryHandler,
          "/api/admin/close-entry": closeEntryHandler,
          "/api/admin/start-cycle": startCycleHandler,
          "/api/admin/reset-investments": resetInvestmentsHandler,
          "/api/request-withdrawal": requestWithdrawalHandler,
          "/api/submit-complaint": submitComplaintHandler,
          "/api/submit-reinvestment": submitReinvestmentHandler,
          "/api/submit-payment-proof": submitPaymentProofHandler,
          "/api/update-profile": updateProfileHandler,
        },
        "PUT": {
          "/api/admin/announcements": announcementsHandler,
          "/api/admin/complaints": complaintsHandler,
        },
        "DELETE": {
          "/api/admin/announcements": announcementsHandler,
        }
      };

      const handler = routes[req.method]?.[url.pathname];

      if (handler) {
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) body += chunk;
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
          }
        } else {
          const query = {};
          url.searchParams.forEach((value, key) => { query[key] = value; });
          req.query = query;
        }

        let responded = false;
        const resObj = {
          status(code) { res.statusCode = code; return this; },
          json(obj) {
            if (responded) return;
            responded = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };

        try {
          await handler(req, resObj);
          return;
        } catch (err) {
          console.error("Handler error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
          return;
        }
      }

      console.warn(`⚠ 404: Route not found: ${req.method} ${url.pathname}`);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `API route not found: ${req.method} ${url.pathname}` }));
    } catch (err) {
      console.error("Server error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Local API server running on http://${HOST}:${PORT} (fallback mode)`);
  });
}
