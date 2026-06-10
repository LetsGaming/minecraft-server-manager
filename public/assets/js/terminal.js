// ── Module-level state (one terminal per page) ─────────────────────────────

let _term = null;
let _socket = null;
let _resizeHandler = null;

// ── Theme palettes ─────────────────────────────────────────────────────────
// Mirror the CSS variable values so xterm's canvas matches the UI themes.

const TERMINAL_THEMES = {
  emerald: {
    background: "#0f172a",
    foreground: "#4ade80",
    cursor: "#4ade80",
    cursorAccent: "#0f172a",
    selection: "rgba(74,  222, 128, 0.25)",
  },
  cyber: {
    background: "#020617",
    foreground: "#f0abfc",
    cursor: "#f0abfc",
    cursorAccent: "#020617",
    selection: "rgba(240, 171, 252, 0.25)",
  },
  sandstone: {
    background: "#1c1917",
    foreground: "#f59e0b",
    cursor: "#f59e0b",
    cursorAccent: "#1c1917",
    selection: "rgba(245, 158,  11, 0.25)",
  },
};

export function getTerminalTheme(name) {
  return TERMINAL_THEMES[name] ?? TERMINAL_THEMES.emerald;
}

/** Live-update the running terminal's colour scheme without reconnecting. */
export function applyTerminalTheme(name) {
  if (_term) _term.options.theme = getTerminalTheme(name);
}

/** Tear down any running terminal + WebSocket cleanly. */
export function destroyTerminal() {
  if (_resizeHandler) {
    window.removeEventListener("resize", _resizeHandler);
    _resizeHandler = null;
  }
  if (_socket) {
    try {
      _socket.close();
    } catch {
      /* already closed */
    }
    _socket = null;
  }
  if (_term) {
    try {
      _term.dispose();
    } catch {
      /* already disposed */
    }
    _term = null;
  }
}

// ── Terminal entry point ───────────────────────────────────────────────────

/**
 * @param {() => void} onClose    — called when the WS connection closes
 * @param {string}     instanceId — the instance to connect the terminal to
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

  // Clean up any previous instance before creating a new one
  destroyTerminal();

  try {
    const themeName = localStorage.getItem("pref-theme") || "emerald";

    _term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: getTerminalTheme(themeName),
    });

    const fitAddon = new FitAddon.FitAddon();
    _term.loadAddon(fitAddon);
    _term.open(termEl);
    fitAddon.fit();

    _resizeHandler = () => fitAddon.fit();
    window.addEventListener("resize", _resizeHandler);
  } catch (err) {
    console.error("Terminal init error:", err);
    termEl.textContent = "Failed to initialise terminal: " + err.message;
    destroyTerminal();
    if (onClose) onClose();
    return;
  }

  // ── Obtain a one-time WebSocket ticket ────────────────────────────────────
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
      _term.writeln("\r\n[Authentication failed — please log in again]");
      destroyTerminal();
      if (onClose) onClose();
      return;
    }
    ({ ticket } = await res.json());
  } catch (err) {
    _term.writeln("\r\n[Could not obtain WS ticket: " + err.message + "]");
    destroyTerminal();
    if (onClose) onClose();
    return;
  }

  // ── Connect to the per-instance WebSocket ─────────────────────────────────
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  _socket = new WebSocket(
    `${proto}//${location.host}/instances/${instanceId}/terminal?ticket=${ticket}`,
  );

  _socket.addEventListener("open", () =>
    _term.writeln("Connected to server.\r\n"),
  );
  _socket.addEventListener("message", (e) => _term.write(e.data));
  _socket.addEventListener("close", () => {
    if (_term) _term.writeln("\r\n[Connection closed]");
    _socket = null;
    if (onClose) onClose();
  });
  _socket.addEventListener("error", () => {
    if (_term) _term.writeln("\r\n[WebSocket error]");
  });

  // Line-buffer: send on Enter, handle backspace
  let buf = "";
  _term.onData((data) => {
    if (data === "\r") {
      _socket?.send(buf + "\n");
      _term.write("\r\n");
      buf = "";
    } else if (data === "\u007f") {
      if (buf.length) {
        buf = buf.slice(0, -1);
        _term.write("\b \b");
      }
    } else {
      buf += data;
      _term.write(data);
    }
  });
}
