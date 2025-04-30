const express = require("express");
const router = express.Router();
const backupController = require("../controllers/backupController");

router.post("/backup", backupController.createBackup);
router.post("/restore", backupController.restoreBackup);
router.get("/list-backups", backupController.listBackups);
router.get("/download", backupController.downloadBackup);

module.exports = router;
