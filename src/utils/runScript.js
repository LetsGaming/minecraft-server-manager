const { exec } = require("child_process");
const config = require("../config/config.json");
const USER = config.USER || "root"; // Default to root if USER is not set

module.exports.runScript = (scriptPath, sudo = false) => {
  return new Promise((resolve, reject) => {
    const command = sudo
      ? `sudo -u ${USER} bash "${scriptPath}"`
      : `bash "${scriptPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: stderr || error.message });
      } else {
        resolve({ output: stdout });
      }
    });
  });
};
