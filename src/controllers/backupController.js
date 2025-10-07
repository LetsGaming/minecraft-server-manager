const path = require("path");
const fs = require("fs");
const { runScript } = require("../utils/runScript");
const { INSTANCE_NAME } = require("../config/config.json");
const BACKUP_DIR = path.join(SERVER_PATH, "..", "backups", INSTANCE_NAME);
const SCRIPTS = global.SCRIPTS;

const getBackups = (dir) => {
  let backups = [];
  if (!fs.existsSync(dir)) {
    return backups;
  }
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      backups = backups.concat(getBackups(filePath)); // Recurse into subdirectories
    } else if (file.endsWith(".tar.gz") || file.endsWith(".tar.zst")) {
      backups.push({
        name: file, // Just the file name
        path: filePath, // Full path to the file
      });
    }
  });

  return backups;
};

module.exports = {
  createBackup: async (req, res) => {
    try {
      const { archive } = req.body;
      const result = await runScript(
        `${SCRIPTS.backup} ${archive ? "--archive" : ""}`
      );
      res.json(result || { message: "Backup created." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  restoreBackup: async (req, res) => {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: "No backup file specified." });
    }

    try {
      const result = await runScript(
        `${SCRIPTS.restore} --file "${path.join(BACKUP_DIR, file)}"`
      );
      res.json(result || { message: "Backup restored." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  downloadBackup: (req, res) => {
    const { file } = req.query;
  
    if (!file) {
      return res.status(400).json({ error: "No backup file specified." });
    }
  
    // Determine full file path
    let filePath;
    if (path.isAbsolute(file)) {
      filePath = file;
    } else {
      const backups = getBackups(BACKUP_DIR);
      const backup = backups.find(b => path.basename(b.name) === file);
      if (backup) {
        filePath = backup.path;
      } else {
        return res.status(404).json({ error: "Backup file not found." });
      }
    }
  
    // Check file existence
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file not found." });
    }
  
    // Set Content-Length for progress tracking
    try {
      const stat = fs.statSync(filePath);
      res.setHeader("Content-Length", stat.size);
    } catch (err) {
      console.error("Failed to stat file:", err);
      return res.status(500).json({ error: "Failed to read file metadata." });
    }
  
    // Trigger download
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        console.error("Error downloading backup:", err);
        // Don't send JSON if headers already sent
        if (!res.headersSent) {
          res.status(500).json({ error: "Error downloading backup." });
        }
      }
    });
  },
  listBackups: (req, res) => {
    const backups = getBackups(BACKUP_DIR);
    res.json(backups);
  },
};
