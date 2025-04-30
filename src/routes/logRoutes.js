const express = require("express");
const router = express.Router();
const logController = require("../controllers/logController");

router.get("/log", logController.getLogs);

module.exports = router;
