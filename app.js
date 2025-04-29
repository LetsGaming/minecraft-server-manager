const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// Load config.json
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const SCRIPT_DIR = config.scriptDir;
const SERVER_PATH = config.serverPath;
const LOG_LINES = config.logLines || 100; // Default to 100 lines if not specified 
const BACKUP_DIR = path.join(SERVER_PATH, "backups");

// Define script paths
const SCRIPTS = {
  status: path.join(SCRIPT_DIR, "status.sh"),
  start: path.join(SCRIPT_DIR, "start.sh"),
  shutdown: path.join(SCRIPT_DIR, "shutdown.sh"),
  restart: path.join(SCRIPT_DIR, "restart.sh"),
  backup: path.join(SCRIPT_DIR, "backup", "backup.sh"),
  restore: path.join(SCRIPT_DIR, "backup", "restore.sh"),
};

app.use(express.static("public"));
app.use(express.json());

// Helper to run script
function runScript(scriptPath, sudo = false) {
  if (!fs.existsSync(scriptPath)) {
    return Promise.reject({ error: `Script not found: ${scriptPath}` });
  }
  return new Promise((resolve, reject) => {
    const command = sudo ? `sudo bash "${scriptPath}"` : `bash "${scriptPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: stderr || error.message });
      } else {
        resolve({ output: stdout });
      }
    });
  });
}

// POST endpoints
app.post("/start", async (req, res) => {
  try {
    const result = await runScript(SCRIPTS.start, true);
    res.json(result || { message: "Server started." });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/shutdown", async (req, res) => {
  try {
    const result = await runScript(SCRIPTS.shutdown, true);
    res.json(result || { message: "Server shut down." });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/restart", async (req, res) => {
  try {
    const result = await runScript(SCRIPTS.restart, true);
    res.json(result || { message: "Server restarted." });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/backup", async (req, res) => {
  try {
    const { archive } = req.body;

    const result = await runScript(
      `${SCRIPTS.backup} ${archive ? "--archive" : ""}`
    );
    res.json(result || { message: "Backup created." });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Restore backup
app.post("/restore", async (req, res) => {
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
});

app.get("/download", (req, res) => {
  const fileName = req.query.file;
  if (!fileName) {
    return res.status(400).json({ error: "No file specified." });
  }

  const filePath = path.isAbsolute(fileName) ? fileName : path.join(BACKUP_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }

  const fileSize = fs.statSync(filePath).size;
  console.log(`File size: ${fileSize} bytes`);

  // Stream the file instead of loading it into memory
  const fileStream = fs.createReadStream(filePath);
  res.setHeader("Content-Length", fileSize);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);

  fileStream.pipe(res).on("finish", () => {
    console.log("File download complete");
  }).on("error", (err) => {
    console.error("Error during streaming:", err);
    res.status(500).json({ error: "Error downloading file." });
  });
});

app.get("/status", async (req, res) => {
  try {
    const result = await runScript(SCRIPTS.status);
    res.json(result || { message: "No status available." });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Serve logs
app.get("/log", (req, res) => {
  const logFile = path.join(SERVER_PATH, "logs", "latest.log");
  const fallbackLogFile = path.join(__dirname, "public", "test.log");

  if (!fs.existsSync(logFile)) {
    return serveLogFile(fallbackLogFile, res);
  }

  serveLogFile(logFile, res);
});

function serveLogFile(filePath, res) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading log file." });
    }
    const lines = data.trim().split("\n");
    const lastLines = lines.slice(-LOG_LINES).join("\n");
    res.type("text/plain").send(lastLines);
  });
}

// List available backups
app.get("/list-backups", (req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) {
    return res.status(500).json({ error: "Backup directory does not exist." });
  }

  // Function to get all backups recursively from subdirectories
  const getBackups = (dir) => {
    let backups = [];
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        // If it's a directory, recursively search for backups in it
        backups = backups.concat(getBackups(filePath));
      } else if (file.endsWith(".tar.gz") || file.endsWith(".tar.zst")) {
        // If it's a backup file, add it to the list
        backups.push({ name: filePath });
      }
    });

    return backups;
  };

  const backups = getBackups(BACKUP_DIR);

  res.json(backups);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
