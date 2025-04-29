const path = require("path");
const fs = require("fs");

function getRootDir(currentDir) {
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error("Could not find project root");
}

module.exports = {
  getRootDir,
};
