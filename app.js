"use strict";

const express = require("express");
const expressWs = require("express-ws");
const http = require("http");
const config = require("./src/config");

// Eagerly initialise the instance registry so config errors surface at startup
// rather than on the first request.
const registry = require("./src/registry");

const app = express();
const server = http.createServer(app);
expressWs(app, server);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.static("public"));
app.use(express.json({ limit: "4kb" })); // tight limit — only short payloads expected

// ── Security headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // CSP: ws:/wss: required for the WebSocket terminal connection.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors 'none'",
  );
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/", require("./src/routes/authRoutes"));
app.use("/instances", require("./src/routes/instanceRoutes"));

// terminalRoutes registers its ws route directly on app (not a Router) because
// express-ws 5.x only patches the app instance, not express.Router() instances.
require("./src/routes/terminalRoutes")(app);

// ── Start ────────────────────────────────────────────────────────────────────
const port = config.PORT;
const instanceList = [...registry.keys()].join(", ");

server
  .listen(port, () => {
    console.log(`Minecraft Server Manager running on port ${port}`);
    console.log(`  Instances: ${instanceList}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Change PORT in config.json.`,
      );
    } else {
      console.error(`Failed to start: ${err.message}`);
    }
    process.exit(1);
  });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
