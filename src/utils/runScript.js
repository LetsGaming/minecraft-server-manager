"use strict";

const { spawn } = require("child_process");

/**
 * Runs a management bash script as the configured Linux user via passwordless
 * sudo (-n flag). Now accepts an instance config object instead of relying on
 * the global singleton config.
 *
 * @param {string}   scriptPath
 * @param {string[]} args
 * @param {{ linuxUser: string, scriptDir: string }} cfg  — instance config
 * @param {{ timeoutMs?: number }} opts
 */
function runScript(scriptPath, args = [], cfg, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "sudo",
      ["-n", "-u", cfg.linuxUser, "bash", scriptPath, ...args],
      {
        cwd: cfg.scriptDir,
        env: { ...process.env, HOME: `/home/${cfg.linuxUser}` },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

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

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (killed) return;
      clearTimeout(timer);

      const cleanStderr = stderr
        .split("\n")
        .filter((l) => !l.includes("[sudo]") && !l.includes("password for"))
        .join("\n")
        .trim();

      if (
        /sudo:.*password is required|not in the sudoers|authentication failure/i.test(
          cleanStderr,
        )
      ) {
        reject({
          error:
            "Passwordless sudo is not configured. See docs/sudoers-setup.md.",
          output: cleanStderr,
        });
        return;
      }

      if (code === 0) {
        resolve({ output: stdout.trim() || "Command completed successfully." });
      } else {
        reject({
          error: `Script exited with code ${code}`,
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
