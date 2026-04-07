const express = require("express");
const { createHeavyLimiter } = require("../utils/rateLimiter");
const articleController = require("../controllers/articleController");

const router = express.Router();
const heavyLimiter = createHeavyLimiter();

function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "Expected application/json" });
    return;
  }
  next();
}

/** GET /api/articles — published articles (requires Supabase service role on server). */
router.get("/", articleController.listArticles);

/** POST /api/articles/factcheck — full AI + NewsData.io pipeline (rate-limited). */
router.post("/factcheck", heavyLimiter, requireJson, articleController.factcheck);

/** POST /api/articles/summary — OpenAI / HF summary from article HTML/text (rate-limited). */
router.post("/summary", heavyLimiter, requireJson, articleController.summarize);

/** POST /api/articles/submit-review — fact-check + optional auto-publish (rate-limited, requires Bearer token). */
router.post("/submit-review", heavyLimiter, requireJson, articleController.submitForReview);

module.exports = router;
