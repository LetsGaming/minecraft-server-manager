const express = require("express");
const expressWs = require("express-ws");
const http = require("http");
const config = require("./src/config");

const app = express();
const server = http.createServer(app);
expressWs(app, server);

// ── Middleware ──
app.use(express.static("public"));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// ── Routes ──
app.use("/", require("./src/routes/authRoutes"));
app.use("/", require("./src/routes/serverRoutes"));
app.use("/", require("./src/routes/backupRoutes"));
app.use("/", require("./src/routes/logRoutes"));
app.use("/", require("./src/routes/terminalRoutes"));

// ── Start ──
const port = config.PORT;

server.listen(port, () => {
  console.log(`Minecraft Server Manager running on port ${port}`);
  console.log(`  Instance: ${config.INSTANCE_NAME}`);
  console.log(`  Server:   ${config.SERVER_PATH}`);
  console.log(`  RCON:     ${config.USE_RCON ? `enabled (port ${config.RCON_PORT})` : "disabled (using screen)"}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Change PORT in config.json.`);
  } else {
    console.error(`Failed to start: ${err.message}`);
  }
  process.exit(1);
});

// ── Graceful shutdown ──
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
