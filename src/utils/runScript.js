const pty = require('node-pty');
const config = require("../config/config.json");

const USER = config.USER || "root";

/**
 * Runs a script and returns ONLY the clean text output from the script's execution.
 */
module.exports.runScript = (scriptPath, args = [], password = null, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    // We launch bash with flags to disable the interactive prompt and profiles
    // This significantly reduces terminal "noise" in the output.
    const ptyProcess = pty.spawn('bash', ['--noediting', '--noprofile', '--norc'], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    let output = "";
    let hasExited = false;

    const timeout = setTimeout(() => {
      if (!hasExited) {
        hasExited = true;
        ptyProcess.kill();
        reject({ error: `Script timed out after ${timeoutMs / 1000}s`, output: cleanFinalOutput(output) });
      }
    }, timeoutMs);

    const fullArgs = args.join(' ');
    const command = password 
      ? `sudo -p "NODE_SUDO_LOGIN" -u ${USER} bash ${scriptPath} ${fullArgs}; exit\r`
      : `bash ${scriptPath} ${fullArgs}; exit\r`;

    ptyProcess.onData((data) => {
      output += data;
      // Keep stdout.write if you want to see progress in your main console
      process.stdout.write(data);

      if (password) {
        const isPrompt = data.includes("NODE_SUDO_LOGIN") || data.includes(`password for ${USER}`);
        if (isPrompt) {
          ptyProcess.write(`${password}\r`);
        }
      }
    });

    // Helper to scrub terminal noise, ANSI codes, and command echoes
    const cleanFinalOutput = (raw) => {
      // 1. Remove ANSI escape codes (the \u001b... stuff)
      const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      let text = raw.replace(ansiRegex, '');

      // 2. Split into lines and filter
      const lines = text.split(/\r?\n/);
      const filtered = lines.filter(line => {
        const trimmed = line.trim();
        // Ignore empty lines
        if (!trimmed) return false;
        // Ignore the line where we typed the command
        if (trimmed.includes(scriptPath) && (trimmed.includes('sudo') || trimmed.includes('bash'))) return false;
        // Ignore the sudo password prompt
        if (trimmed.includes("NODE_SUDO_LOGIN")) return false;
        // Ignore the final exit command
        if (trimmed === 'exit') return false;
        // Ignore the shell prompt (e.g. "bash-5.0$")
        if (trimmed.match(/^bash-[0-9.]+[#$]/)) return false;
        
        return true;
      });

      return filtered.join('\n').trim();
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
        reject({ error: `Process exited with code ${exitCode}`, output: finalOutput });
      }
    });

    // Write the command to the PTY
    ptyProcess.write(command);
  });
};