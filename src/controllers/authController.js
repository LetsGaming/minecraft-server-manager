const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");

const usersFile = path.join(__dirname, "..", "config", "users.json");

// In-memory token store: token -> { username, created }
const tokenStore = new Map();

const TTL_MS = (config.SESSION_TTL_HOURS || 24) * 3600 * 1000;

// ── Helpers ──

function loadUsers() {
  if (!fs.existsSync(usersFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  } catch {
    return [];
  }
}

function pruneExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore) {
    if (now - data.created > TTL_MS) {
      tokenStore.delete(token);
    }
  }
}

function validateToken(token) {
  if (!token) return null;
  pruneExpiredTokens();

  const data = tokenStore.get(token);
  if (!data) return null;

  const users = loadUsers();
  if (!users.find(u => u.username === data.username)) {
    tokenStore.delete(token);
    return null;
  }

  return data.username;
}

// ── Exports ──

exports.isAuthed = (token) => !!validateToken(token);

exports.isAuthenticated = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const username = validateToken(token);
  if (!username) return res.status(401).json({ message: "Unauthorized" });
  res.json({ message: "Authenticated", username });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required." });
  }

  // Reload users on every login to pick up changes without restart
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  const token = crypto.randomBytes(32).toString("hex");
  tokenStore.set(token, { username, created: Date.now() });

  res.json({ token });
};

exports.logout = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) tokenStore.delete(token);
  res.status(200).json({ message: "Logged out." });
};

exports.tokenStore = tokenStore;
