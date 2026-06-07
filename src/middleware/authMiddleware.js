"use strict";

const { verifyToken } = require("../utils/jwt");
const { TTL_MS }      = require("../controllers/authController");

exports.isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "Missing or invalid Authorization header" });

  const token   = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload)
    return res.status(401).json({ message: "Invalid or expired token" });

  // TTL_MS still exported from authController — single source of truth
  void TTL_MS; // referenced to keep the import aligned with the old contract

  req.user = { username: payload.sub };
  next();
};
