const express = require("express");
const router = express.Router();
const { initTerminal } = require("../controllers/terminalController");
const { isAuthenticated } = require("../middleware/authMiddleware");

// WebSocket route for interactive terminal
router.ws("/ws/terminal", isAuthenticated, (ws, req) => {
  initTerminal(ws);
});

module.exports = router;
