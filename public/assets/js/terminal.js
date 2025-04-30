export function terminal() {
  try {
    const terminal = new Terminal({
      fontFamily: "monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: {
        background: "#2d2d2d" /* Dark background */,
        foreground: "#a8e6a1" /* Light green text */,
      },
    });

    const fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(document.getElementById("terminal"));
    fitAddon.fit();

    const token = localStorage.getItem("token");
    const socket = new WebSocket(
      `ws://${location.host}/ws/terminal?token=${token}`
    );

    socket.addEventListener("open", () => {
      terminal.writeln("Connected to server.\r\n");
    });

    socket.addEventListener("message", (event) => {
      terminal.write(event.data);
    });

    socket.addEventListener("close", () => {
      terminal.writeln("\r\n[Connection closed]");
    });

    socket.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
      terminal.writeln("\r\n[WebSocket error]");
    });

    terminal.onData((data) => {
      socket.send(data);
    });

    // Resize terminal on window resize
    window.addEventListener("resize", () => {
      fitAddon.fit();
    });
  } catch (error) {
    console.error("Error initializing terminal:", error);
  }
}
