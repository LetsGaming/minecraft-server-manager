const path = require("path");
const fs = require("fs");
const { runScript } = require("../utils/runScript");
const { SERVER_PATH } = require("../config/config.json");
const BACKUP_DIR = path.join(SERVER_PATH, "backups");
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
  
    // Check if the provided file is a full path or just a file name
    let filePath;
    if (path.isAbsolute(file)) {
      // If it's a full path, use it directly
      filePath = file;
    } else {
      // If it's just a name, search for it in the backup directory
      const backups = getBackups(BACKUP_DIR);
      const backup = backups.find(b => path.basename(b.name) === file);
      if (backup) {
        filePath = backup.path; // Use full path found in the backup list
      } else {
        return res.status(404).json({ error: "Backup file not found." });
      }
    }
  
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file not found." });
    }
  
    // Proceed with the download
    res.download(filePath, (err) => {
      if (err) {
        console.error("Error downloading backup:", err);
        res.status(500).json({ error: "Error downloading backup." });
      }
    });
  },
  listBackups: (req, res) => {
    const backups = getBackups(BACKUP_DIR);
    res.json(backups);
  },
};
