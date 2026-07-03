const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const usersFile = path.join(__dirname, "..", "src", "config", "users.json");
const configDir = path.dirname(usersFile);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([]), "utf-8");
}

const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));

const register = async (username, password) => {
  if (!username || !password) {
    console.error("Username and password are required.");
    process.exit(1);
  }

  if (users.find((u) => u.username === username)) {
    console.error("User already exists.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf-8");
  console.log(`User "${username}" registered successfully.`);
};

// Get arguments from CLI.
// SEC-06: prefer the password from the REGISTER_PASSWORD env var so it never
// appears in the world-readable process argument list (`ps` / /proc/<pid>/cmdline).
// Passing it positionally still works for manual/interactive use.
const [, , username, argvPassword] = process.argv;
const password = process.env.REGISTER_PASSWORD ?? argvPassword;
register(username, password);
