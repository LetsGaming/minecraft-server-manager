const pty = require("node-pty");
const config = require("../config/config.json");

const USER = config.USER || "root";

/**
 * Runs a script and returns ONLY the clean text output from the script's execution.
 * History recording is disabled for this session.
 */
module.exports.runScript = (
  scriptPath,
  args = [],
  password = null,
  timeoutMs = 60000
) => {
  return new Promise((resolve, reject) => {
    // 1. We inject HISTFILE=/dev/null into the environment to prevent history logging
    const ptyProcess = pty.spawn(
      "bash",
      ["--noediting", "--noprofile", "--norc"],
      {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: {
          ...process.env,
          HISTFILE: "/dev/null", // Prevents writing to .bash_history
          HISTSIZE: "0", // Ensures no history is kept in memory
        },
      }
    );

    let output = "";
    let hasExited = false;

    const timeout = setTimeout(() => {
      if (!hasExited) {
        hasExited = true;
        ptyProcess.kill();
        reject({
          error: `Script timed out after ${timeoutMs / 1000}s`,
          output: cleanFinalOutput(output),
        });
      }
    }, timeoutMs);

    const fullArgs = args.join(" ");

    const command = password
      ? `  sudo -p "NODE_SUDO_LOGIN" -u ${USER} bash ${scriptPath} ${fullArgs}; exit\r`
      : `  bash ${scriptPath} ${fullArgs}; exit\r`;

    ptyProcess.onData((data) => {
      output += data;
      process.stdout.write(data);

      if (password) {
        const isPrompt =
          data.includes("NODE_SUDO_LOGIN") ||
          data.includes(`password for ${USER}`);
        if (isPrompt) {
          ptyProcess.write(`${password}\r`);
        }
      }
    });

    const cleanFinalOutput = (raw) => {
      const ansiRegex =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      let text = raw.replace(ansiRegex, "");

      const lines = text.split(/\r?\n/);
      const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;

        // Match the logic for excluding the command echo, including the leading space
        if (
          trimmed.includes(scriptPath) &&
          (trimmed.includes("sudo") || trimmed.includes("bash"))
        )
          return false;
        if (trimmed.includes("NODE_SUDO_LOGIN")) return false;
        if (trimmed === "exit") return false;
        if (trimmed.match(/^bash-[0-9.]+[#$]/)) return false;

        return true;
      });

      return filtered.join("\n").trim();
    };

    ptyProcess.onExit(({ exitCode }) => {
      if (hasExited) return;
      hasExited = true;
      clearTimeout(timeout);
      ptyProcess.kill();

      const finalOutput = cleanFinalOutput(output);

      if (exitCode === 0) {
        resolve({ output: finalOutput });
      } else {
        reject({
          error: `Process exited with code ${exitCode}`,
          output: finalOutput,
        });
      }
    });

    // Write the command to the PTY
    ptyProcess.write(command);
  });
};
