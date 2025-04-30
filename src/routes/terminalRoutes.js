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
    console.warn("Unauthorized WebSocket access attempt.");
    ws.send("Unauthorized WebSocket access");
    ws.close();
    return;
  }
  console.log("Websocket authentication successful");
  req.user = tokenStore.get(token);
  initTerminal(ws);
});

module.exports = router;
