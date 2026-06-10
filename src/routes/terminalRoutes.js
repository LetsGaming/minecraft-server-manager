"use strict";

const registry = require("../registry");
const { validateTicket } = require("../controllers/authController");

// express-ws patches the app instance but not express.Router() instances,
// so we export a registration function that attaches the ws route directly
// on the app (which already has .ws() from expressWs(app, server) in app.js).
module.exports = function registerTerminalRoutes(app) {
  // Auth uses a one-time ticket (?ticket=<hex>) obtained from POST /api/ws-ticket.
  // This prevents the JWT from appearing in server access logs.
  app.ws("/instances/:id/terminal", (ws, req) => {
    const { id } = req.params;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticket = url.searchParams.get("ticket");
    const username = validateTicket(ticket);

    if (!username) {
      ws.send("Unauthorized");
      ws.close();
      return;
    }

    const ops = registry.get(id);
    if (!ops) {
      ws.send(`Instance "${id}" not found`);
      ws.close();
      return;
    }

    req.user = { username };
    ops.initTerminal(ws);
  });
};
