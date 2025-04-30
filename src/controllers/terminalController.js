const pty = require("node-pty");
const os = require("os");
const { MODPACK_NAME } = require("../config/config.json");

function initTerminal(ws) {
  console.log("WebSocket connection established.");
  if (os.platform() === "win32") {
    ws.send("Web terminal is not supported on Windows.");
    ws.close();
    return;
  }

  console.log("Checking for existing screen sessions...");
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
    const hasSession = output.includes(`.${MODPACK_NAME}`);
    if (!hasSession) {
      ws.send(`No screen session found for "${MODPACK_NAME}".`);
      ws.close();
      return;
    }

    console.log(`Attaching to screen session "${MODPACK_NAME}"...`);
    const term = pty.spawn("screen", ["-r", MODPACK_NAME], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    term.onData((data) => {
      ws.send(data);
    });

    ws.on("message", (msg) => {
      if (msg === "close") {
        term.kill();
        return;
      }

      const raw = Buffer.from(msg, "utf-8");
      const forbidden = [0x01, 0x03, 0x04];
      const blocked = raw.some((byte) => forbidden.includes(byte));
      if (blocked) {
        ws.send("Blocked unsafe control character (e.g. Ctrl+A, Ctrl+C, Ctrl+D).");
        return;
      }

      term.write(msg);
    });

    ws.on("close", () => {
      term.kill();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      term.kill();
    });
  });
}

module.exports = {
  initTerminal,
};
