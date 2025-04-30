const express = require("express");
const router = express.Router();
const serverController = require("../controllers/serverController");
const { isAuthenticated } = require("../middleware/authMiddleware");

router.post("/start", isAuthenticated, serverController.start);
router.post("/shutdown", isAuthenticated, serverController.shutdown);
router.post("/restart", isAuthenticated, serverController.restart);
router.get("/status", serverController.status);

module.exports = router;
