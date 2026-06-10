"use strict";

const registry = require("../registry");

/**
 * Express middleware that resolves the `:id` route param against the instance
 * registry and attaches the matching operations bundle to `req.ops`.
 * Returns 404 if the instance ID is unknown.
 */
exports.instanceGuard = (req, res, next) => {
  const ops = registry.get(req.params.id);
  if (!ops) {
    return res
      .status(404)
      .json({ error: `Instance "${req.params.id}" not found` });
  }
  req.ops = ops;
  next();
};
