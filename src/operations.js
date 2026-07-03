"use strict";

/**
 * Operations factory — creates an instance-bound operations bundle.
 * Call once per instance at startup; reuse the returned object for all requests.
 *
 * @param {{ id: string, scriptDir: string, instanceName: string, linuxUser: string,
 *           serverPath: string, backupsPath: string, useRcon: boolean,
 *           rconHost: string, rconPort: number, rconPassword: string,
 *           scripts: Record<string, string>, blockedCommands: string[] }} cfg
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { RconClient } = require("./utils/rcon");
const { runScript } = require("./utils/runScript");

/** Filter RCON connect/disconnect noise that clutters the log terminal. */
const RCON_NOISE = ["Thread RCON Client", "RCON Listener", "RCON running on"];

function isNoisyLine(line) {
  return RCON_NOISE.some((p) => line.includes(p));
}

function createOperations(cfg) {
  // ── Per-instance RCON client ───────────────────────────────────────────
  const rcon =
    cfg.useRcon && cfg.rconPassword
      ? new RconClient(cfg.rconHost, cfg.rconPort, cfg.rconPassword)
      : null;

  function isRconAvailable() {
    return cfg.useRcon && !!cfg.rconPassword;
  }

  // ── Backup directory ───────────────────────────────────────────────────
  // Falls back to <serverPath>/../backups/<instanceName> if backupsPath is
  // not configured — matches the behaviour of the original single-instance code.
  const backupDir =
    cfg.backupsPath ||
    (cfg.serverPath
      ? path.join(cfg.serverPath, "..", "backups", cfg.instanceName)
      : "");

  // ── Script operations ──────────────────────────────────────────────────

  /**
   * Run a named management script (start, shutdown, restart, etc.).
   * @param {string}   scriptKey  — key in cfg.scripts
   * @param {string[]} args
   * @param {number}   timeoutMs
   */
  async function execScript(scriptKey, args = [], timeoutMs = 120_000) {
    const script = cfg.scripts[scriptKey];
    if (!script) throw { error: `Unknown script: ${scriptKey}` };
    return runScript(script, args, cfg, { timeoutMs });
  }

  // ── Status ─────────────────────────────────────────────────────────────

  async function getStatus() {
    if (rcon) {
      try {
        const response = await rcon.send("list");
        return { output: `Server Status: Running\n| ${response}` };
      } catch {
        /* fall through to script */
      }
    }
    try {
      return await runScript(cfg.scripts.status, [], cfg, {
        timeoutMs: 15_000,
      });
    } catch {
      return { output: "Server Status: Not Running" };
    }
  }

  // ── RCON command ───────────────────────────────────────────────────────

  async function sendCommand(command) {
    if (!rcon)
      throw new Error("RCON not configured. Use the terminal for commands.");
    return rcon.send(command.replace(/^\//, ""));
  }

  // ── Logs ───────────────────────────────────────────────────────────────

  async function getLogs(lines) {
    const logFile = path.join(cfg.serverPath, "logs", "latest.log");
    if (!fs.existsSync(logFile)) return null; // caller will send the "not found" message

    return new Promise((resolve, reject) => {
      fs.readFile(logFile, "utf8", (err, data) => {
        if (err) return reject(err);
        const all = data.trim().split("\n");
        resolve(all.slice(-Math.min(lines, all.length)).join("\n"));
      });
    });
  }

  // ── Backups ────────────────────────────────────────────────────────────

  function _scanBackups(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        results.push(..._scanBackups(filePath));
      } else if (file.endsWith(".tar.gz") || file.endsWith(".tar.zst")) {
        results.push({
          name: file,
          path: path.relative(backupDir, filePath), // no absolute path leak
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }
    return results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  }

  /** Path-traversal guard: resolves a relative backup path and ensures it
   *  stays inside backupDir. Returns null on a traversal attempt. */
  function _resolveBackup(relativePath) {
    if (!backupDir) return null;
    const resolved = path.resolve(backupDir, relativePath);
    if (
      !resolved.startsWith(path.resolve(backupDir) + path.sep) &&
      resolved !== path.resolve(backupDir)
    )
      return null;
    return resolved;
  }

  function listBackups() {
    return _scanBackups(backupDir);
  }

  async function createBackup(archive = false) {
    return execScript("backup", archive ? ["--archive"] : [], 600_000);
  }

  async function restoreBackup(file) {
    if (!backupDir)
      throw {
        status: 400,
        error: "Backup directory not configured for this instance.",
      };
    const filePath = _resolveBackup(file);
    if (!filePath) throw { status: 403, error: "Invalid backup path." };
    if (!fs.existsSync(filePath))
      throw { status: 404, error: "Backup file not found." };
    return runScript(cfg.scripts.restore, ["--file", filePath, "--y"], cfg, {
      timeoutMs: 600_000,
    });
  }

  function downloadBackup(file, res) {
    if (!backupDir)
      return res
        .status(400)
        .json({ error: "Backup directory not configured for this instance." });
    const filePath = _resolveBackup(file);
    if (!filePath)
      return res.status(403).json({ error: "Invalid backup path." });
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "Backup file not found." });
    try {
      const stat = fs.statSync(filePath);
      res.setHeader("Content-Length", stat.size);
      res.download(filePath, path.basename(filePath), (err) => {
        if (err && !res.headersSent)
          res.status(500).json({ error: "Error downloading backup." });
      });
    } catch {
      res.status(500).json({ error: "Failed to read file metadata." });
    }
  }

  // ── Terminal (WebSocket) ───────────────────────────────────────────────

  function initTerminal(ws) {
    if (os.platform() === "win32") {
      ws.send("Web terminal is not supported on Windows.");
      ws.close();
      return;
    }
    if (isRconAvailable()) {
      _rconTerminal(ws);
    } else {
      _screenTerminal(ws);
    }
  }

  function _isBlocked(msg) {
    // SEC-05: normalise by stripping any leading slashes before matching.
    // Otherwise a blocked "stop" is trivially reached as "/stop", because the
    // RCON path strips the leading "/" only *after* this check runs.
    const normalized = msg.trim().replace(/^\/+/, "").toLowerCase();
    return (cfg.blockedCommands || []).some((b) =>
      normalized.startsWith(String(b).trim().replace(/^\/+/, "").toLowerCase()),
    );
  }

  function _rconTerminal(ws) {
    ws.send("[Connected via RCON]\r\n");

    const logFile = path.resolve(cfg.serverPath, "logs", "latest.log");
    let tail = null;

    if (fs.existsSync(logFile)) {
      tail = spawn("tail", ["-n", "20", "-f", logFile]);
      tail.stdout.on("data", (data) => {
        const filtered = data
          .toString()
          .split("\n")
          .filter((l) => !isNoisyLine(l))
          .join("\r\n");
        if (filtered)
          try {
            ws.send(filtered);
          } catch {
            /* ws closed */
          }
      });
      tail.stderr.on("data", (d) => {
        try {
          ws.send(d.toString());
        } catch {
          /* */
        }
      });
    } else {
      ws.send("[Log file not found — commands still sent via RCON]\r\n");
    }

    ws.on("message", async (msg) => {
      const raw = msg.toString().trim();
      if (raw === "close") {
        if (tail) tail.kill();
        ws.close();
        return;
      }
      if (_isBlocked(raw)) {
        ws.send(`[Blocked] Command not allowed: ${raw}\r\n`);
        return;
      }
      try {
        const response = await rcon.send(raw.replace(/^\//, ""));
        if (response.trim()) ws.send(`> ${response.trim()}\r\n`);
      } catch (err) {
        ws.send(`[RCON Error] ${err.message}\r\n`);
      }
    });
    ws.on("close", () => {
      if (tail) tail.kill();
    });
    ws.on("error", () => {
      if (tail) tail.kill();
    });
  }

  function _screenTerminal(ws) {
    const sessionName = cfg.instanceName;
    const logFile = path.resolve(cfg.serverPath, "logs", "latest.log");

    const check = spawn("screen", ["-ls"]);
    let screenOut = "";
    check.stdout.on("data", (d) => {
      screenOut += d.toString();
    });

    check.on("close", () => {
      if (!screenOut.includes(`.${sessionName}`)) {
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
        const filtered = data
          .toString()
          .split("\n")
          .filter((l) => !isNoisyLine(l))
          .join("\r\n");
        if (filtered)
          try {
            ws.send(filtered);
          } catch {
            /* */
          }
      });

      ws.on("message", (msg) => {
        const raw = msg.toString();
        if (raw === "close") {
          tail.kill();
          return;
        }

        // Block dangerous control characters
        const buf = Buffer.from(raw, "utf-8");
        if (buf.some((b) => [0x01, 0x03, 0x04].includes(b))) {
          ws.send("[Blocked] Unsafe control character.\r\n");
          return;
        }
        if (_isBlocked(raw)) {
          ws.send(`[Blocked] Command not allowed: ${raw.trim()}\r\n`);
          return;
        }

        const send = spawn("screen", [
          "-S",
          sessionName,
          "-X",
          "stuff",
          `${raw.trim()}\n`,
        ]);
        send.on("close", (code) => {
          if (code !== 0)
            try {
              ws.send("[Error] Failed to send command.\r\n");
            } catch {
              /* */
            }
        });
      });

      ws.on("close", () => tail.kill());
      ws.on("error", () => tail.kill());
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    cfg,
    isRconAvailable,
    getStatus,
    execScript,
    sendCommand,
    getLogs,
    listBackups,
    createBackup,
    restoreBackup,
    downloadBackup,
    initTerminal,
  };
}

module.exports = { createOperations };
