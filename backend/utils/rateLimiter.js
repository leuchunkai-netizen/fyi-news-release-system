const rateLimit = require("express-rate-limit");

/** General API throttle (tune per deployment). */
function createApiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
}

/** Stricter limit for LLM-heavy routes. */
function createHeavyLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_HEAVY_RATE_LIMIT_MAX || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many AI requests, please try again later." },
  });
}

module.exports = { createApiLimiter, createHeavyLimiter };
