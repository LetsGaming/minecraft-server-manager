const { spawn } = require("child_process");
const config = require("../config");

/**
 * Runs a bash script and returns its output.
 * 
 * When a password is provided, the script is executed via:
 *   sudo -S -u <USER> bash <script> <args>
 * The password is piped to stdin (sudo -S reads from stdin).
 * No PTY, no prompt detection, no native modules.
 */
function runScript(scriptPath, args = [], { password = null, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let cmd, cmdArgs;

    if (password) {
      cmd = "sudo";
      cmdArgs = ["-S", "-u", config.USER, "bash", scriptPath, ...args];
    } else {
      cmd = "bash";
      cmdArgs = [scriptPath, ...args];
    }

    const child = spawn(cmd, cmdArgs, {
      cwd: config.SCRIPT_DIR,
      env: { ...process.env, HOME: process.env.HOME },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Feed password to sudo via stdin, then close stdin
    if (password) {
      child.stdin.write(password + "\n");
      child.stdin.end();
    } else {
      child.stdin.end();
    }

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

      // Filter sudo noise from output
      const cleanStderr = stderr
        .split("\n")
        .filter(line => !line.includes("[sudo]") && !line.includes("password for"))
        .join("\n")
        .trim();

      if (code === 0) {
        resolve({ output: stdout.trim() || "Command completed successfully." });
      } else {
        const errMsg = cleanStderr.includes("incorrect password")
          ? "Incorrect sudo password."
          : `Script exited with code ${code}`;
        reject({
          error: errMsg,
          output: (stdout + "\n" + cleanStderr).trim(),
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
