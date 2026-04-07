/**
 * Text normalization and validation for article submission → fact-check pipeline.
 *
 * Order: length check → garbage filter → (rate limit on route) → … downstream services
 */

function stripHtml(input) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combineTitleBody(title, body) {
  return [title, body].filter(Boolean).join("\n\n").trim();
}

const DEFAULT_MIN_CHARS = 80;
const DEFAULT_MAX_CHARS = 120_000;

function validateSubmissionLength(text) {
  const t = String(text || "").trim();
  const min = Number(process.env.MIN_ARTICLE_CHARS || DEFAULT_MIN_CHARS);
  const max = Number(process.env.MAX_ARTICLE_CHARS || DEFAULT_MAX_CHARS);
  if (t.length < min) {
    return { ok: false, error: `Article too short for analysis (minimum ${min} characters).`, stage: "length" };
  }
  if (t.length > max) {
    return { ok: false, error: "Article too long.", stage: "length" };
  }
  return { ok: true };
}

function isProbablyGarbage(text) {
  const t = stripHtml(text);
  if (t.length < 15) return true;
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  if (letters / Math.max(t.length, 1) < 0.15) return true;
  /** Repeated single characters / keyboard mash */
  if (/^(.)\1{12,}$/i.test(t.replace(/\s/g, ""))) return true;
  return false;
}

function validateNotGarbage(text) {
  if (isProbablyGarbage(text)) {
    return {
      ok: false,
      error: "Content does not pass quality checks (too short, non-text, or low signal).",
      stage: "garbage",
    };
  }
  return { ok: true };
}

/** Legacy: non-empty + max length only (used where min length is not required). */
function validateArticleText(text) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, error: "Missing title/body" };
  if (t.length > DEFAULT_MAX_CHARS) return { ok: false, error: "Combined text too long" };
  return { ok: true };
}

/**
 * Full gate for POST /api/articles/factcheck (matches submission pipeline).
 */
function validateForFactcheckPipeline(title, body) {
  const text = combineTitleBody(title, body);
  const len = validateSubmissionLength(text);
  if (!len.ok) return len;
  const clean = validateNotGarbage(text);
  if (!clean.ok) return clean;
  return { ok: true, text };
}

function sanitizeQuery(q, maxLen = 200) {
  return stripHtml(q).slice(0, maxLen);
}

module.exports = {
  stripHtml,
  combineTitleBody,
  validateArticleText,
  validateSubmissionLength,
  validateNotGarbage,
  validateForFactcheckPipeline,
  isProbablyGarbage,
  sanitizeQuery,
};
