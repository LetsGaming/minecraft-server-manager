"use strict";

const express    = require("express");
const router     = express.Router();
const logController = require("../controllers/logController");

// Logs are unauthenticated — the frontend polls them without a token.
// Sensitive server actions (start/stop/backup etc.) remain behind isAuthenticated.
router.get("/log", logController.getLogs);

module.exports = router;
