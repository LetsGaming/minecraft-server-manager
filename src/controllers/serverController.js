const { runScript } = require("../utils/runScript");
const SCRIPTS = global.SCRIPTS;

// A helper to wrap script execution logic
const handleScript = (scriptKey, successMsg) => async (req, res) => {
  try {
    const password = req.body.password || null;
    const result = await runScript(SCRIPTS[scriptKey], [], password);
    
    res.json(result || { message: successMsg });
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  status:      handleScript("status",      "Server status retrieved."),
  start:       handleScript("start",       "Server started."),
  shutdown:    handleScript("shutdown",    "Server shut down."),
  restart:     handleScript("restart",     "Server restarted.")
};