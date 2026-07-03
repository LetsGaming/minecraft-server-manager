"use strict";

const path = require("path");
const fs = require("fs");

const rawConfig = require("./config.json");

// ── Helpers ────────────────────────────────────────────────────────────────

function loadVarsFile(scriptDir) {
  const varsFile = path.join(scriptDir, "common", "variables.txt");
  const vars = {};
  if (!fs.existsSync(varsFile)) {
    console.warn(
      `[config] variables.txt not found at ${varsFile} — using config.json values only`,
    );
    return vars;
  }
  for (const line of fs.readFileSync(varsFile, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[m[1]] = val;
  }
  return vars;
}

/**
 * Normalise a raw instance entry from config.json into a fully-resolved
 * instance config object. Variables.txt (if present in scriptDir/common/)
 * takes precedence over config.json values.
 */
function normaliseInstance(id, raw) {
  const scriptDir = raw.scriptDir || raw.SCRIPT_DIR || "";
  if (!scriptDir) {
    console.error(`[config] Instance "${id}": "scriptDir" is required`);
    process.exit(1);
  }

  const vars = loadVarsFile(scriptDir);

  // vars.txt > config.json value > fallback
  const pick = (varKey, rawKey, fallback = "") => {
    if (vars[varKey] !== undefined && vars[varKey] !== "") return vars[varKey];
    if (raw[rawKey] !== undefined && raw[rawKey] !== null && raw[rawKey] !== "")
      return String(raw[rawKey]);
    return fallback;
  };

  const serverPath = pick("SERVER_PATH", "serverPath", "");
  if (!serverPath) {
    console.warn(
      `[config] Instance "${id}": SERVER_PATH not set — some features may not work`,
    );
  }

  const useRconRaw = vars.USE_RCON ?? raw.useRcon ?? "false";
  const useRcon = useRconRaw === true || useRconRaw === "true";

  return {
    id,
    scriptDir,
    instanceName: pick("INSTANCE_NAME", "instanceName", id),
    linuxUser: pick("USER", "linuxUser", "minecraft"),
    serverPath,
    backupsPath: pick("BACKUPS_PATH", "backupsPath", ""),
    useRcon,
    rconHost: pick("RCON_HOST", "rconHost", "localhost"),
    rconPort: parseInt(pick("RCON_PORT", "rconPort", "25575"), 10),
    rconPassword: pick("RCON_PASSWORD", "rconPassword", ""),
    scripts: {
      status: path.join(scriptDir, "misc", "status.sh"),
      start: path.join(scriptDir, "start.sh"),
      shutdown: path.join(scriptDir, "shutdown.sh"),
      restart: path.join(scriptDir, "restart.sh"),
      smartRestart: path.join(scriptDir, "smart_restart.sh"),
      rollback: path.join(scriptDir, "rollback.sh"),
      backup: path.join(scriptDir, "backup", "backup.sh"),
      restore: path.join(scriptDir, "backup", "restore.sh"),
    },
  };
}

// ── Build instance map ─────────────────────────────────────────────────────
// New format:  { "instances": { "id": { "scriptDir": "..." } } }
// Legacy format (v2): flat config.json with SCRIPT_DIR, SERVER_PATH, etc.

let instances;

if (
  rawConfig.instances &&
  typeof rawConfig.instances === "object" &&
  Object.keys(rawConfig.instances).length
) {
  // Multi-instance mode
  instances = Object.fromEntries(
    Object.entries(rawConfig.instances).map(([id, inst]) => [
      id,
      normaliseInstance(id, inst),
    ]),
  );
} else {
  // Backward-compat: legacy flat config.json (single-instance, v2 format)
  const id = rawConfig.INSTANCE_NAME || "server";
  console.warn(
    "[config] No 'instances' key found — using legacy single-instance format.",
  );
  instances = {
    [id]: normaliseInstance(id, {
      scriptDir: rawConfig.SCRIPT_DIR || "",
      instanceName: rawConfig.INSTANCE_NAME,
      linuxUser: rawConfig.USER,
      serverPath: rawConfig.SERVER_PATH,
      backupsPath: rawConfig.BACKUPS_PATH,
      useRcon: rawConfig.USE_RCON,
      rconHost: rawConfig.RCON_HOST,
      rconPort: rawConfig.RCON_PORT,
      rconPassword: rawConfig.RCON_PASSWORD,
    }),
  };
}

module.exports = {
  PORT: rawConfig.PORT || 3000,
  LOG_LINES: rawConfig.LOG_LINES || 1000,
  BLOCKED_COMMANDS: rawConfig.BLOCKED_COMMANDS || [],
  SESSION_TTL_HOURS: rawConfig.SESSION_TTL_HOURS || 24,
  // SEC-04: when false, the status + log routes require authentication. Default
  // true preserves the pre-login dashboard behaviour. Regardless of this flag,
  // IP addresses are redacted from the public log route (see instanceRoutes.js).
  PUBLIC_LOGS: rawConfig.PUBLIC_LOGS !== false,
  instances,
};
