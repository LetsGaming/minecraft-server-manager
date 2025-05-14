const pty = require("node-pty");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  INSTANCE_NAME,
  SERVER_PATH,
  BLOCKED_COMMANDS,
} = require("../config/config.json");

function isBlockedCommand(msg) {
  const normalized = msg.trim().toLowerCase();
  return BLOCKED_COMMANDS.some((blocked) => normalized.startsWith(blocked));
}

function initTerminal(ws) {
  console.log("WebSocket connection established.");

  if (os.platform() === "win32") {
    ws.send("Web terminal is not supported on Windows.");
    ws.close();
    return;
  }

  const sessionName = INSTANCE_NAME;
  const logFile = path.resolve(SERVER_PATH, "logs", "latest.log");

  const check = pty.spawn("screen", ["-ls"], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env,
  });

  let output = "";
  check.onData((data) => {
    output += data;
  });

  check.onExit(() => {
    const hasSession = output.includes(`.${sessionName}`);
    if (!hasSession) {
      ws.send(`No screen session found for "${sessionName}".`);
      ws.close();
      return;
    }

    if (!fs.existsSync(logFile)) {
      ws.send("Minecraft log file not found.");
      ws.close();
      return;
    }

    const tail = pty.spawn("tail", ["-n", "10", "-f", logFile], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    tail.onData((data) => {
      ws.send(data);
    });

    ws.on("message", (msg) => {
      if (msg === "close") {
        tail.kill();
        return;
      }

      const raw = Buffer.from(msg, "utf-8");
      const forbiddenBytes = [0x01, 0x03, 0x04];
      const hasControlChars = raw.some((byte) => forbiddenBytes.includes(byte));
      if (hasControlChars) {
        ws.send(
          "Blocked unsafe control character (e.g. Ctrl+A, Ctrl+C, Ctrl+D)."
        );
        return;
      }

      if (isBlockedCommand(msg)) {
        ws.send(`Blocked command: "${msg.trim()}" is not allowed.`);
        return;
      }

      const formatted = `${msg.trim()}\n`;
      const send = pty.spawn(
        "screen",
        ["-S", sessionName, "-X", "stuff", formatted],
        {
          name: "xterm-color",
          cwd: process.cwd(),
          env: process.env,
        }
      );

      send.onExit(({ exitCode }) => {
        if (exitCode !== 0) {
          ws.send(`Failed to send command: ${msg}`);
        }
      });
    });

    ws.on("close", () => {
      tail.kill();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      tail.kill();
    });
  });
}

module.exports = {
  initTerminal,
};
