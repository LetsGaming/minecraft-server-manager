const { tokenStore } = require("../controllers/authController");

exports.isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const username = tokenStore.get(token);

  if (!username) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Attach the username to the request for downstream use
  req.user = { username };
  next();
};
