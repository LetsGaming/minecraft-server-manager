const path = require("path");
const fs = require("fs");
const { SERVER_PATH, LOG_LINES } = require("../config/config.json");
const { getRootDir } = require("../utils/utils");

module.exports = {
  getLogs: (req, res) => {
    const logFile = path.join(SERVER_PATH, "logs", "latest.log");
    const fallbackLogFile = path.join(getRootDir(__dirname), "public", "test.log");

    if (!fs.existsSync(logFile)) {
      return serveLogFile(fallbackLogFile, res);
    }

    serveLogFile(logFile, res);
  },
};

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
