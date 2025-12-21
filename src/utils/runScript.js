const { spawn } = require("child_process");

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
      // -S: read password from stdin
      // -p '' to hide default prompt (we detect it manually)
      finalArgs = ["-S", "-p", "", "-u", USER, "bash", script, ...args];
    } else {
      command = "bash";
      finalArgs = [script, ...args];
    }

    const child = spawn(command, finalArgs, { shell: false });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;

      if (sudo && password) {
        // Detect password prompt from sudo
        if (str.includes("[sudo] password")) {
          child.stdin.write(password + "\n");
        }
      }
    });

    child.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;

      if (sudo && password) {
        if (str.includes("[sudo] password")) {
          child.stdin.write(password + "\n");
        }
      }
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
