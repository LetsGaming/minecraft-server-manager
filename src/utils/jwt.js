"use strict";

/**
 * Minimal HMAC-SHA256 JWT implementation using only Node.js built-ins.
 *
 * Format:  base64url(header).base64url(payload).base64url(sig)
 * Algorithm: HS256 (HMAC-SHA256)
 *
 * The secret is read from process.env.JWT_SECRET at startup.
 * If not set, a fresh random secret is generated per-process (tokens
 * survive restarts only when JWT_SECRET is set in the environment).
 */

const crypto = require("crypto");

// ── Secret ────────────────────────────────────────────────────────────────
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.JWT_SECRET) {
  process.stderr.write(
    "[auth] JWT_SECRET env var not set — generating a per-process secret.\n" +
      "       Active sessions will be invalidated on restart.\n" +
      "       Set JWT_SECRET in your environment for persistent sessions.\n",
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(str) {
  // Re-pad and convert back to standard base64
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function sign(headerPayload) {
  return b64url(
    crypto.createHmac("sha256", SECRET).update(headerPayload).digest(),
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Issue a JWT for the given username with the given TTL (seconds).
 *
 * @param {string} username
 * @param {number} ttlSeconds  — defaults to 24 h
 * @returns {string}  — compact JWT string
 */
function issueToken(username, ttlSeconds = 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ sub: username, iat: now, exp: now + ttlSeconds }),
  );
  return `${HEADER}.${payload}.${sign(`${HEADER}.${payload}`)}`;
}

/**
 * Verify a JWT and return the payload, or null on any failure.
 *
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number } | null}
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  // Constant-time comparison to prevent timing oracle on the signature
  const expected = sign(`${header}.${payload}`);
  const sigBuf = b64urlDecode(sig);
  const expBuf = b64urlDecode(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let decoded;
  try {
    decoded = JSON.parse(b64urlDecode(payload).toString("utf-8"));
  } catch {
    return null;
  }

  if (Math.floor(Date.now() / 1000) > decoded.exp) return null; // expired
  return decoded;
}

module.exports = { issueToken, verifyToken, SECRET };
