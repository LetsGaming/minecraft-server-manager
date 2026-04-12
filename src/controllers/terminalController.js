const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const config = require("../config");
const { sendRconCommand, isRconAvailable } = require("../utils/rcon");

function isBlockedCommand(msg) {
  const normalized = msg.trim().toLowerCase();
  return config.BLOCKED_COMMANDS.some(blocked => normalized.startsWith(blocked));
}

function initTerminal(ws) {
  if (os.platform() === "win32") {
    ws.send("Web terminal is not supported on Windows.");
    ws.close();
    return;
  }

  if (isRconAvailable()) {
    initRconTerminal(ws);
  } else {
    initScreenTerminal(ws);
  }
}

// ── RCON-based terminal ──
function initRconTerminal(ws) {
  ws.send("[Connected via RCON]\r\n");

  // Tail the log file for output
  const logFile = path.resolve(config.SERVER_PATH, "logs", "latest.log");
  let tailProc = null;

  if (fs.existsSync(logFile)) {
    tailProc = spawn("tail", ["-n", "20", "-f", logFile]);
    tailProc.stdout.on("data", (data) => {
      try { ws.send(data.toString()); } catch { /* ws closed */ }
    });
    tailProc.stderr.on("data", (data) => {
      try { ws.send(data.toString()); } catch { /* ws closed */ }
    });
  } else {
    ws.send("[Log file not found — commands will still be sent via RCON]\r\n");
  }

  ws.on("message", async (msg) => {
    const raw = msg.toString().trim();
    if (raw === "close") {
      if (tailProc) tailProc.kill();
      ws.close();
      return;
    }

    if (isBlockedCommand(raw)) {
      ws.send(`[Blocked] Command not allowed: ${raw}\r\n`);
      return;
    }

    try {
      const cmd = raw.replace(/^\//, ""); // RCON doesn't use /
      const response = await sendRconCommand(cmd);
      if (response.trim()) {
        ws.send(`> ${response.trim()}\r\n`);
      }
    } catch (err) {
      ws.send(`[RCON Error] ${err.message}\r\n`);
    }
  });

  ws.on("close", () => { if (tailProc) tailProc.kill(); });
  ws.on("error", () => { if (tailProc) tailProc.kill(); });
}

// ── Screen-based terminal (fallback) ──
function initScreenTerminal(ws) {
  const sessionName = config.INSTANCE_NAME;
  const logFile = path.resolve(config.SERVER_PATH, "logs", "latest.log");

  // Check screen session exists
  const check = spawn("screen", ["-ls"]);
  let screenOutput = "";
  check.stdout.on("data", d => { screenOutput += d.toString(); });

  check.on("close", () => {
    if (!screenOutput.includes(`.${sessionName}`)) {
      ws.send(`No screen session found for "${sessionName}".`);
      ws.close();
      return;
    }

    if (!fs.existsSync(logFile)) {
      ws.send("Minecraft log file not found.");
      ws.close();
      return;
    }

    ws.send("[Connected via Screen]\r\n");

    const tail = spawn("tail", ["-n", "20", "-f", logFile]);
    tail.stdout.on("data", (data) => {
      try { ws.send(data.toString()); } catch { /* ws closed */ }
    });

    ws.on("message", (msg) => {
      const raw = msg.toString();
      if (raw === "close") { tail.kill(); return; }

      // Block control characters
      const buf = Buffer.from(raw, "utf-8");
      if (buf.some(b => [0x01, 0x03, 0x04].includes(b))) {
        ws.send("[Blocked] Unsafe control character.\r\n");
        return;
      }

      if (isBlockedCommand(raw)) {
        ws.send(`[Blocked] Command not allowed: ${raw.trim()}\r\n`);
        return;
      }

      const formatted = `${raw.trim()}\n`;
      const send = spawn("screen", ["-S", sessionName, "-X", "stuff", formatted]);
      send.on("close", (code) => {
        if (code !== 0) {
          try { ws.send(`[Error] Failed to send command.\r\n`); } catch { /* */ }
        }
      });
    });

    ws.on("close", () => tail.kill());
    ws.on("error", () => tail.kill());
  });
}

module.exports = { initTerminal };
