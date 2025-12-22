const { spawn } = require("child_process");
const path = require("path");

/**
 * Runs a script as another user using sudo -A (Askpass)
 * @param {string} scriptPath - Full path to the .sh script to run
 * @param {Array} args - Arguments to pass to the script
 * @param {string} password - The sudo password
 */
module.exports.runScript = (scriptPath, args = [], password = null) => {
  return new Promise((resolve, reject) => {
    const askpassPath = path.join(__dirname, "askpass.sh");

    // -A tells sudo to use the program defined in SUDO_ASKPASS
    // -u minecraft tells sudo to run as the minecraft user
    const finalArgs = ["-A", "-u", "minecraft", "bash", scriptPath, ...args];

    const child = spawn("sudo", finalArgs, {
      env: {
        ...process.env,
        NODE_SUDO_PW: password,      // Password passed safely via env
        SUDO_ASKPASS: askpassPath,   // Path to our helper script
        DISPLAY: ":0",               // Often required to "trick" sudo into askpass mode
        LANG: "C"                    // Standardize output language
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Keep logging to console for screen/progress monitoring
      console.log(`[Script]: ${chunk.trim()}`);
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
      } else {
        // If it fails, stderr will usually contain why (e.g. incorrect password)
        reject({ 
          error: stderr.trim() || `Process exited with code ${code}`,
          code: code 
        });
      }
    });

    // Error handling for the spawn process itself
    child.on("error", (err) => {
      reject({ error: err.message });
    });
  });
};