const pty = require('node-pty');
const path = require('path');

const config = require("../config/config.json");
const USER = config.USER || "root"; // Default to root if USER is not set

/**
 * Runs a script simulating a real terminal to handle interactive sudo prompts.
 */
module.exports.runScript = (scriptPath, args = [], password = null) => {
  return new Promise((resolve, reject) => {

    // Create the Pseudo-Terminal (PTY)
    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    let output = "";
    
    // We use a custom prompt "NODE_SUDO_LOGIN" to catch the password request reliably
    const command = `sudo -p "NODE_SUDO_LOGIN" -u ${USER} bash ${scriptPath} ${args.join(' ')}\r`;

    ptyProcess.onData((data) => {
      output += data;
      
      // This shows the script progress in your 'screen' session in real-time
      process.stdout.write(data);

      // We "type" the password if we see our custom prompt OR the standard sudo prompt
      // This handles both the initial sudo AND any sudo calls inside the .sh file
      const isPrompt = data.includes("NODE_SUDO_LOGIN") || data.includes(`password for ${USER}`);
      
      if (isPrompt && password) {
        ptyProcess.write(`${password}\r`);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (exitCode === 0) {
        resolve({ output: output.trim() });
      } else {
        reject({ error: `Process exited with code ${exitCode}`, output });
      }
    });

    // Send the command to the virtual terminal
    ptyProcess.write(command);
  });
};