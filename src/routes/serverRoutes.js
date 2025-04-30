const express = require("express");
const router = express.Router();
const serverController = require("../controllers/serverController");

router.post("/start", serverController.start);
router.post("/shutdown", serverController.shutdown);
router.post("/restart", serverController.restart);
router.get("/status", serverController.status);

module.exports = router;
