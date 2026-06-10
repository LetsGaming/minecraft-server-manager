"use strict";

const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { issueToken, verifyToken } = require("../utils/jwt");

const usersFile = path.join(__dirname, "..", "config", "users.json");

// ── Shared TTL constant ────────────────────────────────────────────────────
const TTL_MS = (config.SESSION_TTL_HOURS || 24) * 3600 * 1000;
const TTL_S = Math.floor(TTL_MS / 1000);
exports.TTL_MS = TTL_MS;

// ── Legacy tokenStore (used only by authMiddleware for backward compat) ────
// Kept as an empty Map so authMiddleware.js can still import it without
// breaking — new sessions use JWTs and never touch this store.
// The WebSocket ticket store below remains Map-based (30 s, single-use).
const tokenStore = new Map();
exports.tokenStore = tokenStore;

// ── One-time WebSocket ticket store ───────────────────────────────────────
const TICKET_TTL_MS = 30_000;
const ticketStore = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function loadUsers() {
  if (!fs.existsSync(usersFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  } catch {
    return [];
  }
}

// ── Ticket helpers ─────────────────────────────────────────────────────────

exports.generateTicket = (username) => {
  const ticket = crypto.randomBytes(16).toString("hex");
  ticketStore.set(ticket, { username, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
};

exports.validateTicket = (ticket) => {
  if (!ticket) return null;
  const data = ticketStore.get(ticket);
  ticketStore.delete(ticket); // single-use — always consume
  if (!data) return null;
  if (Date.now() > data.expiresAt) return null;
  return data.username;
};

// ── Auth helpers ───────────────────────────────────────────────────────────

exports.isAuthed = (token) => !!verifyToken(token);

exports.isAuthenticated = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: "Unauthorized" });
  res.json({ message: "Authenticated", username: payload.sub });
};

// ── Auth endpoints ─────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Username and password required." });

  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  const hash =
    user?.passwordHash ??
    "$2b$10$invalidhashpadding000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid)
    return res.status(401).json({ message: "Invalid credentials" });

  // Issue a stateless JWT — survives restarts when JWT_SECRET env var is set
  const token = issueToken(username, TTL_S);
  res.json({ token });
};

exports.logout = (_req, res) => {
  // JWTs are stateless — the client discards the token.
  // The token remains technically valid until its exp, but the client
  // won't send it again. For paranoid revocation, set a short TTL.
  res.status(200).json({ message: "Logged out." });
};
