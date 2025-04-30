const express = require("express");
const router = express.Router();
const querystring = require("querystring");
const { initTerminal } = require("../controllers/terminalController");
const { isAuthed, tokenStore } = require("../controllers/authController"); // Use this directly

router.ws("/ws/terminal", (ws, req) => {
  const [path, query] = req.url.split("?");
  const params = querystring.parse(query);
  const token = params.token;

  if (!token || !isAuthed(token)) {
    ws.send("Unauthorized WebSocket access");
    ws.close();
    return;
  }
  req.user = tokenStore.get(token);
  initTerminal(ws);
});

module.exports = router;
