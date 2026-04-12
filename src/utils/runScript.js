const { spawn } = require("child_process");
const config = require("../config");

/**
 * Runs a bash script and returns its output.
 * Uses child_process.spawn instead of PTY — simpler, more reliable.
 * The manager should run as the correct user (or via systemd with proper permissions)
 * rather than relying on sudo password injection via PTY prompts.
 */
function runScript(scriptPath, args = [], timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath, ...args], {
      cwd: config.SCRIPT_DIR,
      env: { ...process.env, HOME: process.env.HOME },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      reject({
        error: `Script timed out after ${timeoutMs / 1000}s`,
        output: stdout.trim(),
      });
    }, timeoutMs);

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      if (killed) return;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ output: stdout.trim() || "Command completed successfully." });
      } else {
        reject({
          error: `Script exited with code ${code}`,
          output: (stdout + "\n" + stderr).trim(),
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject({ error: `Failed to start script: ${err.message}` });
    });
  });
}

module.exports = { runScript };
