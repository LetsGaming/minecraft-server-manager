const path = require("path");
const fs = require("fs");
const { SERVER_PATH, LOG_LINES } = require("../config/config.json");
const { getRootDir } = require("../utils/utils");

module.exports = {
  getLogs: (req, res) => {
    const { length } = req.query;
    const logFile = path.join(SERVER_PATH, "logs", "latest.log");
    const fallbackLogFile = path.join(
      getRootDir(__dirname),
      "public",
      "test.log"
    );

    if (!fs.existsSync(logFile)) {
      return serveLogFile(fallbackLogFile, res, undefined, true); // forceFull = true
    }

    serveLogFile(logFile, res, length);
  },
};

function serveLogFile(filePath, res, length = LOG_LINES, forceFull = false) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading log file." });
    }
    const lines = data.trim().split("\n");
    const output = forceFull
      ? lines.join("\n")
      : lines.slice(-length).join("\n");
    res.type("text/plain").send(output);
  });
}
