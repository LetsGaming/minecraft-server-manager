const { spawn } = require("child_process");
const fs = require("fs");
const config = require("../config/config.json");
const USER = config.USER || "root"; // Default to root if USER is not set

module.exports.runScript = (scriptCommand, sudo = false) => {
  return new Promise((resolve, reject) => {
    const parts = scriptCommand.trim().split(/\s+/);
    const script = parts[0];
    const args = parts.slice(1);

    // Check if the script exists
    if (!fs.existsSync(script)) {
      return reject({ error: `Script not found: ${script}` });
    }

    const command = sudo ? "sudo" : "bash";
    const finalArgs = sudo
      ? ["-u", USER, "bash", script, ...args]
      : [script, ...args];

    const child = spawn(command, finalArgs, { shell: false });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output: stdout });
      } else {
        reject({ error: stderr || `Script exited with code ${code}` });
      }
    });
  });
};
