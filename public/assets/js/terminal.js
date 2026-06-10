/**
 * @param {() => void}      onClose      — called when the WS connection closes
 * @param {string}          instanceId   — the instance to connect the terminal to
 */
export async function terminal(onClose, instanceId) {
  const termEl = document.getElementById("terminal");
  if (!termEl) return;

  if (!instanceId) {
    termEl.textContent = "No instance selected.";
    if (onClose) onClose();
    return;
  }

  // Guard: xterm must be loaded via CDN before this runs
  if (typeof Terminal === "undefined" || typeof FitAddon === "undefined") {
    termEl.textContent =
      "Terminal libraries not loaded. Check your network connection.";
    if (onClose) onClose();
    return;
  }

  let term;
  try {
    term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: {
        background: "#0f172a",
        foreground: "#4ade80",
        cursor: "#4ade80",
        selection: "rgba(74, 222, 128, 0.3)",
      },
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(termEl);
    fitAddon.fit();
    window.addEventListener("resize", () => fitAddon.fit());
  } catch (err) {
    console.error("Terminal init error:", err);
    termEl.textContent = "Failed to initialise terminal: " + err.message;
    if (onClose) onClose();
    return;
  }

  // ── Obtain a one-time WebSocket ticket ────────────────────────────────────
  // The JWT must not appear in the WS URL (visible in server access logs).
  // Exchange it here for a short-lived single-use ticket instead.
  const token = localStorage.getItem("token");
  let ticket;
  try {
    const res = await fetch("/api/ws-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      term.writeln("\r\n[Authentication failed — please log in again]");
      if (onClose) onClose();
      return;
    }
    ({ ticket } = await res.json());
  } catch (err) {
    term.writeln("\r\n[Could not obtain WS ticket: " + err.message + "]");
    if (onClose) onClose();
    return;
  }

  // ── Connect to the per-instance WebSocket ─────────────────────────────────
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${proto}//${location.host}/instances/${instanceId}/terminal?ticket=${ticket}`,
  );

  socket.addEventListener("open", () =>
    term.writeln("Connected to server.\r\n"),
  );
  socket.addEventListener("message", (e) => term.write(e.data));
  socket.addEventListener("close", () => {
    term.writeln("\r\n[Connection closed]");
    if (onClose) onClose();
  });
  socket.addEventListener("error", () => term.writeln("\r\n[WebSocket error]"));

  // Line-buffer: send on Enter, handle backspace
  let buf = "";
  term.onData((data) => {
    if (data === "\r") {
      socket.send(buf + "\n");
      term.write("\r\n");
      buf = "";
    } else if (data === "\u007f") {
      if (buf.length) {
        buf = buf.slice(0, -1);
        term.write("\b \b");
      }
    } else {
      buf += data;
      term.write(data);
    }
  });
}
