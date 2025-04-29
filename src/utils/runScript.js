const { exec } = require("child_process");

module.exports.runScript = (scriptPath, sudo = false) => {
  return new Promise((resolve, reject) => {
    const command = sudo ? `sudo bash "${scriptPath}"` : `bash "${scriptPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: stderr || error.message });
      } else {
        resolve({ output: stdout });
      }
    });
  });
};
