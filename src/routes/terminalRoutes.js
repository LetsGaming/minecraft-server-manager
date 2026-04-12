const express = require("express");
const router = express.Router();
const { initTerminal } = require("../controllers/terminalController");
const { isAuthed, tokenStore } = require("../controllers/authController");

router.ws("/ws/terminal", (ws, req) => {
  // Extract token from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token || !isAuthed(token)) {
    ws.send("Unauthorized");
    ws.close();
    return;
  }

  const data = tokenStore.get(token);
  req.user = { username: data?.username };
  initTerminal(ws);
});

module.exports = router;
