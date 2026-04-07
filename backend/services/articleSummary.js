/**
 * Short reader-facing summary: OpenAI → Hugging Face → extractive fallback (no user-authored excerpt).
 */
const crypto = require("crypto");
const filters = require("../utils/filters");

function stripHtml(input) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractiveFallback(title, text) {
  const t = stripHtml(text);
  if (!t) return title || "No content to summarize.";
  const snippet = t.slice(0, 320).trim();
  const cut = snippet.lastIndexOf(" ", 280);
  const body = cut > 100 ? snippet.slice(0, cut) : snippet;
  return `${body}${t.length > body.length ? "…" : ""}`;
}

function hfToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || null;
}

let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    const OpenAI = require("openai");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

async function hfSummarize(title, text) {
  const token = hfToken();
  if (!token) return null;

  const model =
    process.env.HUGGINGFACE_SUMMARY_MODEL ||
    process.env.HUGGINGFACE_CLAIM_MODEL ||
    "meta-llama/Llama-3.2-3B-Instruct";
  const system =
    "Write a neutral 2–3 sentence summary for news readers. No title line, no bullet points, no 'This article' preamble.";
  const user = `Title: ${title || "(none)"}\n\nText:\n${text.slice(0, 12_000)}`;

  const endpoints = [
    "https://router.huggingface.co/v1/chat/completions",
    "https://api-inference.huggingface.co/v1/chat/completions",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 256,
          temperature: 0.3,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const out = typeof content === "string" ? content.trim() : "";
      if (out.length > 40) return out.slice(0, 1200);
    } catch {
      /* next */
    }
  }
  return null;
}

async function openaiSummarize(title, text) {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "Write a neutral 2–3 sentence summary for news readers. Do not use bullet points. Do not repeat the title verbatim as its own sentence.",
        },
        {
          role: "user",
          content: `Title: ${title || "(none)"}\n\nArticle:\n${text.slice(0, 14_000)}`,
        },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content;
    const out = String(raw || "").trim();
    return out.length > 30 ? out.slice(0, 1200) : null;
  } catch (e) {
    console.warn("[articleSummary] OpenAI failed:", e.message || e);
    return null;
  }
}

/**
 * @param {{ title?: string, content: string }} params
 * @returns {Promise<{ summary: string, source: "openai"|"huggingface"|"extract" }>}
 */
async function generateArticleSummary(params) {
  const title = params.title ? String(params.title).trim() : "";
  const content = params.content != null ? String(params.content) : "";
  const combined = filters.combineTitleBody(title, content);
  if (combined.length < 50) {
    return { summary: extractiveFallback(title, content), source: "extract" };
  }

  const plain = stripHtml(content);
  const fromOpenai = await openaiSummarize(title, plain);
  if (fromOpenai) return { summary: fromOpenai, source: "openai" };

  const fromHf = await hfSummarize(title, plain);
  if (fromHf) return { summary: fromHf, source: "huggingface" };

  return { summary: extractiveFallback(title, content), source: "extract" };
}

/**
 * Stable hash for cache invalidation when title or HTML body changes (matches summarization input).
 * @param {string} [title]
 * @param {string} [content] raw article HTML or text
 * @returns {string} hex sha256
 */
function summaryContentHash(title, content) {
  const t = String(title ?? "").trim();
  const plain = stripHtml(content);
  return crypto.createHash("sha256").update(`${t}\n${plain}`, "utf8").digest("hex");
}

module.exports = { generateArticleSummary, extractiveFallback, summaryContentHash };
