const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const http = require("http");
const config = require("./src/config/config.json");

let initialized = false;

function initWebSocket(app, server) {
  if (initialized) return;
  expressWs(app, server);
  initialized = true;
}

const app = express();
const server = http.createServer(app);
initWebSocket(app, server);

const SCRIPT_DIR = config.SCRIPT_DIR;
let port = config.PORT || 3000;

const SCRIPTS = {
  status: path.join(SCRIPT_DIR, "misc", "status.sh"),
  start: path.join(SCRIPT_DIR, "start.sh"),
  shutdown: path.join(SCRIPT_DIR, "shutdown.sh"),
  restart: path.join(SCRIPT_DIR, "restart.sh"),
  backup: path.join(SCRIPT_DIR, "backup", "backup.sh"),
  restore: path.join(SCRIPT_DIR, "backup", "restore.sh"),
};

global.SCRIPTS = SCRIPTS;

app.use(express.static("public"));
app.use(express.json());

app.ws("/ws/echo", (ws, req) => {
  ws.on("message", (msg) => {
    console.log(`Received message: ${msg}`);
    ws.send(`Echo: ${msg}`);
  });
});

// Use Routers
app.use("/", require("./src/routes/authRoutes"));
app.use("/", require("./src/routes/serverRoutes"));
app.use("/", require("./src/routes/backupRoutes"));
app.use("/", require("./src/routes/logRoutes"));
app.use("/", require("./src/routes/terminalRoutes"));

// Try to listen on available ports
function tryListen(port) {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });
}

tryListen(port);

module.exports = app;
