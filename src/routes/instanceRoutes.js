"use strict";

/**
 * All instance-specific routes, mounted at /instances in app.js.
 *
 * GET  /instances                  — list configured instances
 * GET  /instances/:id/status       — server status (unauthenticated)
 * POST /instances/:id/start        — start server
 * POST /instances/:id/shutdown     — stop server
 * POST /instances/:id/restart      — restart server
 * POST /instances/:id/smart-restart
 * POST /instances/:id/rollback
 * POST /instances/:id/command      — send RCON command
 * GET  /instances/:id/log          — tail log file (unauthenticated)
 * GET  /instances/:id/list-backups
 * GET  /instances/:id/download     — stream backup file
 * POST /instances/:id/backup       — create backup
 * POST /instances/:id/restore      — restore backup
 */

const express = require("express");
const router = express.Router();
const registry = require("../registry");
const globalConfig = require("../config");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { instanceGuard } = require("../middleware/instanceMiddleware");

// SEC-04: gate status/logs behind auth when PUBLIC_LOGS is disabled; otherwise
// leave them open for the pre-login dashboard (the historical default).
const maybeAuth = globalConfig.PUBLIC_LOGS
  ? (_req, _res, next) => next()
  : isAuthenticated;

// SEC-04: strip IP addresses from log output served on the public route so
// player IPs aren't disclosed pre-login. Covers vanilla's "[/1.2.3.4:5678]"
// join lines, bare IPv4, and common IPv6 forms.
function redactIps(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\/(?:\d{1,3}\.){3}\d{1,3}:\d+/g, "/[redacted]")
    .replace(/(?:\d{1,3}\.){3}\d{1,3}/g, "[redacted-ip]")
    .replace(/\b(?:[0-9a-f]{0,4}:){3,7}[0-9a-f]{0,4}\b/gi, "[redacted-ip6]");
}

// ── GET /instances ─────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  const instances = [...registry.keys()].map((id) => ({
    id,
    instanceName: registry.get(id).cfg.instanceName,
  }));
  res.json({ instances });
});

// ── Apply instance guard to all /:id/* routes ──────────────────────────────
router.use("/:id", instanceGuard);

// ── Status ─────────────────────────────────────────────────────────────────
// Public by default (front page shows status before login); set PUBLIC_LOGS:false
// in config.json to require auth here. (SEC-04)
router.get("/:id/status", maybeAuth, async (req, res) => {
  try {
    res.json(await req.ops.getStatus());
  } catch (err) {
    res.status(500).json(err);
  }
});

// ── Script operations ──────────────────────────────────────────────────────
router.post("/:id/start", isAuthenticated, async (req, res) => {
  try {
    res.json(
      (await req.ops.execScript("start")) || { message: "Server started." },
    );
  } catch (err) {
    res.status(500).json(err);
  }
});
router.post("/:id/shutdown", isAuthenticated, async (req, res) => {
  try {
    res.json(
      (await req.ops.execScript("shutdown")) || {
        message: "Server shut down.",
      },
    );
  } catch (err) {
    res.status(500).json(err);
  }
});
router.post("/:id/restart", isAuthenticated, async (req, res) => {
  try {
    res.json(
      (await req.ops.execScript("restart")) || { message: "Server restarted." },
    );
  } catch (err) {
    res.status(500).json(err);
  }
});
router.post("/:id/smart-restart", isAuthenticated, async (req, res) => {
  try {
    res.json(
      (await req.ops.execScript("smartRestart")) || {
        message: "Server restarted (smart).",
      },
    );
  } catch (err) {
    res.status(500).json(err);
  }
});
router.post("/:id/rollback", isAuthenticated, async (req, res) => {
  try {
    res.json(
      (await req.ops.execScript("rollback", ["--y"], 300_000)) || {
        message: "Rollback complete.",
      },
    );
  } catch (err) {
    res.status(500).json(err);
  }
});

// ── RCON command ───────────────────────────────────────────────────────────
router.post("/:id/command", isAuthenticated, async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "No command provided." });

  // Global blocked-commands check (in addition to the terminal's per-message check)
  // SEC-05: strip leading slashes so "/stop" can't bypass a "stop" block.
  const normalized = command.trim().replace(/^\/+/, "").toLowerCase();
  if (
    globalConfig.BLOCKED_COMMANDS.some((b) =>
      normalized.startsWith(String(b).trim().replace(/^\/+/, "").toLowerCase()),
    )
  ) {
    return res.status(403).json({ error: `Command blocked: ${command}` });
  }

  if (!req.ops.isRconAvailable()) {
    return res
      .status(400)
      .json({ error: "RCON not configured. Use the terminal for commands." });
  }

  try {
    const response = await req.ops.sendCommand(command);
    res.json({ output: response || "Command sent." });
  } catch (err) {
    res.status(500).json({ error: `RCON error: ${err.message}` });
  }
});

// ── Logs ───────────────────────────────────────────────────────────────────
// Public by default (front page polls logs before login); set PUBLIC_LOGS:false
// to require auth. IP addresses are redacted here regardless — the full,
// unredacted log is available to logged-in users via the WebSocket terminal.
// (SEC-04)
router.get("/:id/log", maybeAuth, async (req, res) => {
  const raw = parseInt(req.query.length, 10);
  const length = Number.isNaN(raw)
    ? globalConfig.LOG_LINES
    : Math.min(Math.max(raw, 1), 5000);

  try {
    const output = await req.ops.getLogs(length);
    if (output === null) {
      return res
        .type("text/plain")
        .send("Log file not found. Server may not have started yet.");
    }
    res.type("text/plain").send(redactIps(output));
  } catch {
    res.status(500).json({ error: "Error reading log file." });
  }
});

// ── Backups ────────────────────────────────────────────────────────────────
router.get("/:id/list-backups", isAuthenticated, (req, res) => {
  res.json(req.ops.listBackups());
});

router.get("/:id/download", isAuthenticated, (req, res) => {
  const { file } = req.query;
  if (!file)
    return res.status(400).json({ error: "No backup file specified." });
  req.ops.downloadBackup(file, res);
});

router.post("/:id/backup", isAuthenticated, async (req, res) => {
  try {
    const result = await req.ops.createBackup(!!req.body.archive);
    res.json(result || { message: "Backup created." });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/:id/restore", isAuthenticated, async (req, res) => {
  const { file } = req.body;
  if (!file)
    return res.status(400).json({ error: "No backup file specified." });
  try {
    const result = await req.ops.restoreBackup(file);
    res.json(result || { message: "Backup restored." });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || err });
  }
});

module.exports = router;
