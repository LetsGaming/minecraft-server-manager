module.exports.runScript = (scriptPath, args = [], password = null, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    let output = "";
    let hasExited = false;

    // 1. Setup the timeout logic
    const timeout = setTimeout(() => {
      if (!hasExited) {
        hasExited = true;
        ptyProcess.kill();
        reject({ 
          error: `Script timed out after ${timeoutMs / 1000}s`, 
          output: output.trim() 
        });
      }
    }, timeoutMs);

    const fullArgs = args.join(' ');
    // We append '; exit' to ensure the shell closes after the script runs
    const command = password 
      ? `sudo -p "NODE_SUDO_LOGIN" -u ${USER} bash ${scriptPath} ${fullArgs}; exit\r`
      : `bash ${scriptPath} ${fullArgs}; exit\r`;

    ptyProcess.onData((data) => {
      output += data;
      process.stdout.write(data);

      if (password) {
        const isPrompt = data.includes("NODE_SUDO_LOGIN") || data.includes(`password for ${USER}`);
        if (isPrompt) {
          ptyProcess.write(`${password}\r`);
        }
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (hasExited) return; // Prevent double-resolving if timeout already triggered
      
      hasExited = true;
      clearTimeout(timeout); // Stop the timer
      ptyProcess.kill();

      if (exitCode === 0) {
        resolve({ output: output.trim() });
      } else {
        reject({ error: `Process exited with code ${exitCode}`, output: output.trim() });
      }
    });

    // Start execution
    ptyProcess.write(command);
  });
};