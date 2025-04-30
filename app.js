const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const config = require("./src/config/config.json");

let initialized = false;

function initWebSocket(app) {
  if (initialized) return;
  expressWs(app);
  initialized = true;
}

const app = express();
initWebSocket(app);

const PORT = config.PORT || 3000;
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

app.use(express.json());

// Use Routers
app.use("/", require("./src/routes/authRoutes"));
app.use("/", require("./src/routes/serverRoutes"));
app.use("/", require("./src/routes/backupRoutes"));
app.use("/", require("./src/routes/logRoutes"));
app.use("/", require("./src/routes/terminalRoutes"));

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
