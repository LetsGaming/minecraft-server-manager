const { spawn } = require("child_process");
const os = require("os");
const { MODPACK_NAME } = require("../config/config.json");

function initTerminal(ws) {
  console.log("WebSocket connection established.");
  const isWindows = os.platform() === "win32";

  if (isWindows) {
    console.warn("Unsupported platform: Windows.");
    ws.send("Web terminal is not supported on Windows.");
    ws.close();
    return;
  }

  console.log("Checking for existing screen sessions...");
  const checkScreen = spawn("screen", ["-ls"]);
  let screenListOutput = "";

  checkScreen.stdout.on("data", (data) => {
    const output = data.toString();
    console.debug("screen -ls output chunk:", output);
    screenListOutput += output;
  });

  checkScreen.on("close", (code) => {
    console.debug(`screen -ls exited with code ${code}`);
    const hasSession = screenListOutput.includes(`.${MODPACK_NAME}`);

    if (!hasSession) {
      console.warn(`No screen session found for "${MODPACK_NAME}".`);
      ws.send(`No screen session found for "${MODPACK_NAME}".`);
      ws.close();
      return;
    }

    console.log(`Attaching to screen session "${MODPACK_NAME}"...`);
    const screenAttach = spawn("screen", ["-r", MODPACK_NAME]);

    screenAttach.on("error", (err) => {
      console.error("Failed to attach to screen session:", err);
      ws.send(`Failed to attach to screen session: ${err.message}`);
      ws.close();
    });

    screenAttach.stdout.on("data", (data) => {
      const output = data.toString();
      console.debug("screen stdout:", output);
      ws.send(output);
    });

    screenAttach.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      console.error("screen stderr:", errorOutput);
      ws.send(errorOutput);
    });

    screenAttach.on("close", (code) => {
      console.log(`Screen session "${MODPACK_NAME}" closed with code ${code}`);
      ws.send(`\nScreen session closed with code ${code}`);
      ws.close();
    });

    ws.on("message", (msg) => {
      console.debug("Received message from WebSocket:", msg);

      if (msg === "close") {
        console.log("Received close command from client.");
        screenAttach.kill();
        return;
      }

      const raw = Buffer.from(msg, "utf-8");
      const forbidden = [0x01, 0x03, 0x04];
      const blocked = raw.some((byte) => forbidden.includes(byte));

      if (blocked) {
        console.warn("Blocked control character in input.");
        ws.send(
          "Blocked unsafe control character (e.g. Ctrl+A, Ctrl+C, Ctrl+D)."
        );
        return;
      }

      screenAttach.stdin.write(raw);
    });

    ws.on("close", () => {
      console.log("WebSocket closed by client.");
      screenAttach.kill();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      screenAttach.kill();
    });
  });

  checkScreen.on("error", (err) => {
    console.error("Error running screen -ls:", err);
    ws.send(`Error checking screen sessions: ${err.message}`);
    ws.close();
  });
}

module.exports = {
  initTerminal,
};
