const expressWs = require("express-ws");
const { spawn } = require("child_process");
const os = require("os");
const { MODPACK_NAME } = require("../config/config.json");

let initialized = false;

// Enable express-ws support (once)
function initWebSocket(app) {
  if (initialized) return;
  expressWs(app);
  initialized = true;
}

function initTerminal(ws) {
  const isWindows = os.platform() === "win32";
  const shell = isWindows ? "powershell.exe" : "bash";
  const shellArgs = isWindows ? ["-NoLogo"] : [];

  const shellProcess = spawn(shell, shellArgs, {
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env,
  });

  // Try to attach to an existing screen session
  if (!isWindows) {
    shellProcess.stdin.write(`screen -r ${MODPACK_NAME}\n`);
  }

  // Receive user input from frontend WebSocket
  ws.on("message", (msg) => {
    if (msg === "close") {
      shellProcess.kill();
      return;
    }
    shellProcess.stdin.write(msg);
  });

  // Send shell output to WebSocket client
  shellProcess.stdout.on("data", (data) => {
    ws.send(data.toString());
  });

  shellProcess.stderr.on("data", (data) => {
    ws.send(data.toString());
  });

  shellProcess.on("close", (code) => {
    ws.send(`\nShell closed with code ${code}`);
    ws.close();
  });

  ws.on("close", () => {
    shellProcess.kill();
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    shellProcess.kill();
  });
}

module.exports = {
  initWebSocket,
  initTerminal,
};
