"use strict";

/**
 * Instance registry — built once at startup, shared across all requests.
 * Maps instance ID → operations bundle (created by createOperations).
 */

const config = require("./config");
const { createOperations } = require("./operations");

const registry = new Map();

for (const [id, instanceCfg] of Object.entries(config.instances)) {
  // Inject the global BLOCKED_COMMANDS into each instance's cfg so
  // operations.js doesn't need to import the global config itself.
  const fullCfg = { ...instanceCfg, blockedCommands: config.BLOCKED_COMMANDS };
  registry.set(id, createOperations(fullCfg));
  console.log(
    `[registry] Loaded instance: ${id} (${instanceCfg.instanceName})`,
  );
}

module.exports = registry;
