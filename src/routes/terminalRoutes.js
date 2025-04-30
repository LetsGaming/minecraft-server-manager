const express = require("express");
const router = express.Router();
const url = require("url");
const { initTerminal } = require("../controllers/terminalController");
const { isAuthed, tokenStore } = require("../controllers/authController"); // Use this directly

router.ws("/ws/terminal", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const token = parsedUrl.query.token;

  if (!token || !isAuthed(token)) {
    ws.send("Unauthorized WebSocket access");
    ws.close();
    return;
  }
  req.user = tokenStore.get(token);
  initTerminal(ws);
});

module.exports = router;
