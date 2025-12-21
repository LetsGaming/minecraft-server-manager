const { spawn } = require("child_process");

module.exports.runScript = (scriptPath, args = [], password = null) => {
  return new Promise((resolve, reject) => {
    // We force a specific prompt string "NODE_SUDO_PROMPT" 
    // so we aren't guessing what the OS will output.
    const finalArgs = ["-S", "-p", "NODE_SUDO_PROMPT", "-u", "minecraft", "bash", scriptPath, ...args];
    
    const child = spawn("sudo", finalArgs, {
      shell: false,
      env: { ...process.env, LANG: "C" } // Force English for predictable parsing
    });

    let stdout = "";
    let stderr = "";

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Check for our custom prompt
      if (chunk.includes("NODE_SUDO_PROMPT") && password) {
        child.stdin.write(password + "\n");
      }
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      // Optional: Log progress to console so you see the "Waiting for save" messages
      console.log(`[Script]: ${data}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
      } else {
        reject({ error: stderr.trim() || `Exit code ${code}` });
      }
    });
  });
};