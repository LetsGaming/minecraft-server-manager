const { runScript } = require("../utils/runScript");
const SCRIPTS = global.SCRIPTS;

module.exports = {
  status: async (req, res) => {
    try {
      const result = await runScript(SCRIPTS.status);
      res.json(result || { message: "Server status retrieved." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  start: async (req, res) => {
    try {
      const password = req.body.password || null;
      const result = await runScript(SCRIPTS.start, [], password);
      res.json(result || { message: "Server started." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  shutdown: async (req, res) => {
    try {
      const password = req.body.password || null;
      const result = await runScript(SCRIPTS.shutdown, [], password);
      res.json(result || { message: "Server shut down." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  restart: async (req, res) => {
    try {
      const password = req.body.password || null;
      const result = await runScript(SCRIPTS.restart, [], password);
      res.json(result || { message: "Server restarted." });
    } catch (err) {
      res.status(500).json(err);
    }
  },
};
