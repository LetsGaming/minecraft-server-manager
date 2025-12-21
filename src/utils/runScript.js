const { spawn } = require("child_process");
const fs = require("fs");
const config = require("../config/config.json");
const USER = config.USER || "root";

module.exports.runScript = (scriptCommand, sudo = false, password = null) => {
  return new Promise((resolve, reject) => {
    const parts = scriptCommand.trim().split(/\s+/);
    const script = parts[0];
    const args = parts.slice(1);

    if (!fs.existsSync(script)) {
      return reject({ error: `Script not found: ${script}` });
    }

    let command;
    let finalArgs;

    if (sudo) {
      command = "sudo";
      // -S reads password from stdin
      // -p '' hides the default [sudo] password prompt
      finalArgs = ["-S", "-p", "", "-u", USER, "bash", script, ...args];
    } else {
      command = "bash";
      finalArgs = [script, ...args];
    }

    const child = spawn(command, finalArgs, { shell: false });

    // If sudo and password provided, write it to the process
    if (sudo && password) {
      child.stdin.write(password + "\n");
      child.stdin.end();
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output: stdout });
      } else {
        // If password was wrong, sudo usually exits with code 1 and writes to stderr
        reject({ error: stderr || `Script exited with code ${code}` });
      }
    });
  });
};