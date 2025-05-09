const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const http = require("http");
const config = require("./src/config/config.json");

const SCRIPT_DIR = config.SCRIPT_DIR;
const SCRIPTS = {
  status: path.join(SCRIPT_DIR, "misc", "status.sh"),
  start: path.join(SCRIPT_DIR, "start.sh"),
  shutdown: path.join(SCRIPT_DIR, "shutdown.sh"),
  restart: path.join(SCRIPT_DIR, "restart.sh"),
  backup: path.join(SCRIPT_DIR, "backup", "backup.sh"),
  restore: path.join(SCRIPT_DIR, "backup", "restore.sh"),
};
global.SCRIPTS = SCRIPTS;

let basePort = config.PORT || 3000;

function createApp(port) {
  const app = express();
  const server = http.createServer(app);
  expressWs(app, server);

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

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      createApp(port + 1); // try again with a fresh app/server
    } else {
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });
}

createApp(basePort);
