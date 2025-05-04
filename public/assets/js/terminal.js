export function terminal() {
  try {
    const terminal = new Terminal({
      fontFamily: "monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: {
        background: "#1b1b1b",
        foreground: "#9ccc65",
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

    let inputBuffer = "";

    terminal.onData((data) => {
      if (data === "\r") {
        // Enter pressed, send the command
        socket.send(inputBuffer + "\n"); // send with newline
        terminal.write("\r\n"); // echo newline in terminal
        inputBuffer = ""; // reset buffer
      } else if (data === "\u007f") {
        // Handle backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          terminal.write("\b \b"); // erase character visually
        }
      } else {
        inputBuffer += data;
        terminal.write(data); // echo character
      }
    });

    window.addEventListener("resize", () => {
      fitAddon.fit();
    });
  } catch (error) {
    console.error("Error initializing terminal:", error);
  }
}
