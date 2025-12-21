const { spawn } = require("child_process");

module.exports.runScript = (scriptCommand, sudo = false, password = null) => {
  return new Promise((resolve, reject) => {
    const [command, ...args] = scriptCommand.trim().split(/\s+/);

    // Using -S to read from stdin and --stdin to be explicit
    const spawnCmd = sudo ? "sudo" : command;
    const spawnArgs = sudo ? ["-S", "bash", command, ...args] : args;

    const child = spawn(spawnCmd, spawnArgs, { shell: false });

    let stdout = "";
    let stderr = "";
    let passwordSent = false;

    // Sudo prompts are almost always sent to STDERR
    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // REACTIVE CHECK: Only send if we haven't yet and we see the prompt
      if (sudo && password && !passwordSent && chunk.toLowerCase().includes("password")) {
        child.stdin.write(password + "\n");
        passwordSent = true;
        // Note: We don't child.stdin.end() here because the 
        // script might need more input later.
      }
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
      } else {
        // Filter out the password prompt from the error message for clarity
        const cleanError = stderr.replace(/\[sudo\] password for .+: /g, "").trim();
        reject({ error: cleanError || `Exited with code ${code}` });
      }
    });

    child.on("error", (err) => reject({ error: err.message }));
  });
};