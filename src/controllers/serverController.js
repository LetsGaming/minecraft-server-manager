const { runScript } = require("../utils/runScript");
const SCRIPTS = global.SCRIPTS;

module.exports = {
  status: async (req, res) => {
    try {
      const result = await runScript(SCRIPTS.status, true);
      res.json(result || { message: "Server status retrieved." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  start: async (req, res) => {
    try {
      const result = await runScript(SCRIPTS.start, true);
      res.json(result || { message: "Server started." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  shutdown: async (req, res) => {
    try {
      const result = await runScript(SCRIPTS.shutdown, true);
      res.json(result || { message: "Server shut down." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  restart: async (req, res) => {
    try {
      const result = await runScript(SCRIPTS.restart, true);
      res.json(result || { message: "Server restarted." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
};
