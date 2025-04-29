const express = require("express");
const path = require("path");
// Load config.json
const config = require("./src/config/config.json");

const app = express();
const PORT = config.PORT || 3000;
const SCRIPT_DIR = config.SCRIPT_DIR;

const SCRIPTS = {
  status: path.join(SCRIPT_DIR, "status.sh"),
  start: path.join(SCRIPT_DIR, "start.sh"),
  shutdown: path.join(SCRIPT_DIR, "shutdown.sh"),
  restart: path.join(SCRIPT_DIR, "restart.sh"),
  backup: path.join(SCRIPT_DIR, "backup", "backup.sh"),
  restore: path.join(SCRIPT_DIR, "backup", "restore.sh"),
};

global.SCRIPTS = SCRIPTS;

app.use(express.static("public"));
app.use(express.json());

// Routes
const serverController = require("./src/controllers/serverController.js");
const backupController = require("./src/controllers/backupController.js");
const logController = require("./src/controllers/logController.js");

// API Endpoints
app.post("/start", serverController.start);
app.post("/shutdown", serverController.shutdown);
app.post("/restart", serverController.restart);
app.post("/backup", backupController.createBackup);
app.post("/restore", backupController.restoreBackup);
app.get("/status", serverController.status);
app.get("/log", logController.getLogs);
app.get("/list-backups", backupController.listBackups);
app.get("/download", backupController.downloadBackup);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
