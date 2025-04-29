module.exports.isAuthenticated = (req, res, next) => {
  // Example authentication middleware
  if (req.headers["x-authenticated"] !== "true") {
    return res.status(403).json({ error: "Not authenticated" });
  }
  next();
};
