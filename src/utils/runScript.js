const pty = require('node-pty');
const path = require('path');

const config = require("../config/config.json");
const USER = config.USER || "root"; 

module.exports.runScript = (scriptPath, args = [], password = null) => {
  return new Promise((resolve, reject) => {

    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    let output = "";
    
    // --- CONDITIONAL SUDO LOGIC ---
    // If password exists, use sudo with a custom prompt. 
    // Otherwise, run the script directly.
    const fullArgs = args.join(' ');
    const command = password 
      ? `sudo -p "NODE_SUDO_LOGIN" -u ${USER} bash ${scriptPath} ${fullArgs}\r`
      : `bash ${scriptPath} ${fullArgs}\r`;

    ptyProcess.onData((data) => {
      output += data;
      process.stdout.write(data);

      // Only attempt to write a password if one was actually provided
      if (password) {
        const isPrompt = data.includes("NODE_SUDO_LOGIN") || data.includes(`password for ${USER}`);
        if (isPrompt) {
          ptyProcess.write(`${password}\r`);
        }
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (exitCode === 0) {
        resolve({ output: output.trim() });
      } else {
        reject({ error: `Process exited with code ${exitCode}`, output });
      }
    });

    ptyProcess.write(command);
  });
};