"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── bcrypt stub (native binding not compiled in sandbox) ──────────────────
const bcryptPath = require.resolve("bcrypt");
if (!require.cache[bcryptPath]) {
  require.cache[bcryptPath] = {
    id: bcryptPath, filename: bcryptPath, loaded: true,
    exports: {
      compare: async () => false,
      hash: async (pw) => `$2b$10$stub.${pw}`,
    },
  };
}

function stubConfig() {
  const cp = require.resolve("../src/config");
  require.cache[cp] = {
    id: cp, filename: cp, loaded: true,
    exports: {
      SESSION_TTL_HOURS: 24, PORT: 3001, SCRIPT_DIR: "/tmp",
      LOG_LINES: 100, BLOCKED_COMMANDS: [], SCRIPTS: {}, SERVER_PATH: "/tmp",
      INSTANCE_NAME: "test", USE_RCON: false, RCON_HOST: "localhost",
      RCON_PORT: 25575, RCON_PASSWORD: "", USER: "mc",
    },
  };
}

function freshModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes("authController") || key.includes("src/utils/jwt")) {
      delete require.cache[key];
    }
  }
  stubConfig();
  const jwt  = require("../src/utils/jwt");
  const auth = require("../src/controllers/authController");
  return { jwt, auth };
}

// ── JWT utility ───────────────────────────────────────────────────────────
describe("jwt — issueToken / verifyToken", () => {
  test("issueToken returns a three-part dot-separated string", () => {
    const { jwt } = freshModules();
    const token = jwt.issueToken("admin");
    assert.strictEqual(token.split(".").length, 3);
  });

  test("verifyToken returns payload for a valid token", () => {
    const { jwt } = freshModules();
    const token   = jwt.issueToken("alice", 3600);
    const payload = jwt.verifyToken(token);
    assert.ok(payload !== null);
    assert.strictEqual(payload.sub, "alice");
  });

  test("verifyToken rejects a tampered payload", () => {
    const { jwt } = freshModules();
    const parts   = jwt.issueToken("admin").split(".");
    // Replace payload with a different one
    const fakePayload = Buffer.from(JSON.stringify({ sub: "hacker", iat: 0, exp: 9999999999 }))
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const tampered = `${parts[0]}.${fakePayload}.${parts[2]}`;
    assert.strictEqual(jwt.verifyToken(tampered), null);
  });

  test("verifyToken rejects an expired token", () => {
    const { jwt } = freshModules();
    const token   = jwt.issueToken("admin", -1); // already expired
    assert.strictEqual(jwt.verifyToken(token), null);
  });

  test("verifyToken returns null for null/undefined/empty", () => {
    const { jwt } = freshModules();
    assert.strictEqual(jwt.verifyToken(null), null);
    assert.strictEqual(jwt.verifyToken(undefined), null);
    assert.strictEqual(jwt.verifyToken(""), null);
  });

  test("verifyToken returns null for a malformed token", () => {
    const { jwt } = freshModules();
    assert.strictEqual(jwt.verifyToken("not.a.jwt.with.too.many.dots"), null);
    assert.strictEqual(jwt.verifyToken("onlyonepart"), null);
  });
});

// ── authController — TTL_MS ───────────────────────────────────────────────
describe("authController — TTL_MS", () => {
  test("exports TTL_MS as a positive number", () => {
    const { auth } = freshModules();
    assert.strictEqual(typeof auth.TTL_MS, "number");
    assert.ok(auth.TTL_MS > 0);
  });

  test("TTL_MS equals SESSION_TTL_HOURS × 3600 × 1000", () => {
    const { auth } = freshModules();
    assert.strictEqual(auth.TTL_MS, 24 * 3600 * 1000);
  });
});

// ── authController — ticket system ────────────────────────────────────────
describe("authController — ticket system", () => {
  test("generateTicket returns a 32-char hex string", () => {
    const { auth } = freshModules();
    assert.match(auth.generateTicket("admin"), /^[0-9a-f]{32}$/);
  });

  test("validateTicket returns username for a valid ticket", () => {
    const { auth }   = freshModules();
    const ticket     = auth.generateTicket("admin");
    assert.strictEqual(auth.validateTicket(ticket), "admin");
  });

  test("validateTicket is single-use", () => {
    const { auth } = freshModules();
    const ticket   = auth.generateTicket("admin");
    auth.validateTicket(ticket);
    assert.strictEqual(auth.validateTicket(ticket), null);
  });

  test("validateTicket returns null for unknown ticket", () => {
    const { auth } = freshModules();
    assert.strictEqual(auth.validateTicket("deadbeef".repeat(4)), null);
  });

  test("validateTicket returns null for null/undefined/empty", () => {
    const { auth } = freshModules();
    assert.strictEqual(auth.validateTicket(null), null);
    assert.strictEqual(auth.validateTicket(undefined), null);
    assert.strictEqual(auth.validateTicket(""), null);
  });

  test("tickets for different users are independent", () => {
    const { auth } = freshModules();
    const t1 = auth.generateTicket("alice");
    const t2 = auth.generateTicket("bob");
    assert.notStrictEqual(t1, t2);
    assert.strictEqual(auth.validateTicket(t1), "alice");
    assert.strictEqual(auth.validateTicket(t2), "bob");
  });
});
