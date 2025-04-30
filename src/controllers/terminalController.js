const { spawn } = require("child_process");
const os = require("os");
const { MODPACK_NAME } = require("../config/config.json");

function initTerminal(ws) {
  console.log("WebSocket connection established.");
  const isWindows = os.platform() === "win32";
  if (isWindows) {
    ws.send("Web terminal is not supported on Windows.");
    ws.close();
    return;
  }

  // Check if the screen session exists
  const checkScreen = spawn("screen", ["-ls"]);
  let screenListOutput = "";

  checkScreen.stdout.on("data", (data) => {
    screenListOutput += data.toString();
  });

  checkScreen.on("close", () => {
    const hasSession = screenListOutput.includes(`.${MODPACK_NAME}`);
    if (!hasSession) {
      ws.send(`No screen session found for "${MODPACK_NAME}".`);
      ws.close();
      return;
    }

    // Attach to the existing screen session (safe entry point)
    const screenAttach = spawn("screen", ["-r", MODPACK_NAME]);

    ws.on("message", (msg) => {
      if (msg === "close") {
        screenAttach.kill();
        return;
      }

      const raw = Buffer.from(msg, "utf-8");

      // Control characters to block: Ctrl+A (0x01), Ctrl+C (0x03), Ctrl+D (0x04)
      const forbidden = [0x01, 0x03, 0x04];
      const blocked = raw.some((byte) => forbidden.includes(byte));

      if (blocked) {
        ws.send(
          "Blocked unsafe control character (e.g. Ctrl+A, Ctrl+C, Ctrl+D)."
        );
        return;
      }

      screenAttach.stdin.write(raw);
    });

    screenAttach.stdout.on("data", (data) => {
      ws.send(data.toString());
    });

    screenAttach.stderr.on("data", (data) => {
      ws.send(data.toString());
    });

    screenAttach.on("close", (code) => {
      ws.send(`\nScreen session closed with code ${code}`);
      ws.close();
    });

    ws.on("close", () => {
      screenAttach.kill();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      screenAttach.kill();
    });
  });

  checkScreen.on("error", (err) => {
    ws.send(`Error checking screen sessions: ${err.message}`);
    ws.close();
  });
}

module.exports = {
  initTerminal,
};
