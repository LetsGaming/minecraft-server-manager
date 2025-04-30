const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const usersFile = path.join(__dirname, "..", "config", "users.json");
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([]), "utf-8");
}
const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));

// In-memory token store (token -> username)
const tokenStore = new Map();

exports.isAuthenticated = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No Token provided" });

  const username = tokenStore.get(token);
  if (!username) return res.status(401).json({ message: "Unauthorized" });

  // Check if the user is still valid
  const user = users.find((u) => u.username === username);
  if (!user) {
    tokenStore.delete(token);
    return res.status(401).json({ message: "Unauthorized" });
  }

  res.status(200).json({ message: "Authenticated", username });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  const user = users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");
  tokenStore.set(token, username);

  res.status(200).json({ token });
};

exports.logout = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    tokenStore.delete(token);
  }
  res.status(201).json({ message: "logged out" });
};

exports.tokenStore = tokenStore;
