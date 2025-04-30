const express = require("express");
const router = express.Router();
const { initTerminal } = require("../controllers/terminalController");

// WebSocket route for interactive terminal
router.ws("/terminal", (ws, req) => {
  initTerminal(ws);
});

module.exports = router;
