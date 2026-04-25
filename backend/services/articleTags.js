const filters = require("../utils/filters");

function stripHtml(input) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeTags(input) {
  const list = Array.isArray(input) ? input : [];
  return Array.from(
    new Set(
      list
        .map((tag) => String(tag || "").trim().toLowerCase())
        .map((tag) => tag.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim())
        .filter((tag) => tag.length >= 2 && tag.length <= 32)
    )
  ).slice(0, 8);
}

function keywordFallback(title, content) {
  const text = `${title || ""} ${stripHtml(content || "")}`.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);

  const stop = new Set([
    "this",
    "that",
    "with",
    "from",
    "have",
    "will",
    "they",
    "their",
    "about",
    "after",
    "before",
    "which",
    "there",
    "where",
    "when",
    "news",
    "article",
    "report",
  ]);

  const counts = new Map();
  for (const w of words) {
    if (stop.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
  return normalizeTags(ranked);
}

async function generateWithOpenAI(title, content) {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_TAGS_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Generate concise news tags. Return JSON only in shape {"tags":["tag one","tag two"]}. ' +
            "Use 4 to 8 lowercase tags, each 1 to 3 words, no punctuation, no duplicates.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: String(title || "").slice(0, 300),
            content: stripHtml(content).slice(0, 12000),
          }),
        },
      ],
      max_tokens: 200,
    });
    const raw = completion.choices?.[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : null;
    const tags = normalizeTags(parsed?.tags);
    return tags.length > 0 ? tags : null;
  } catch (e) {
    console.warn("[articleTags] OpenAI failed:", e.message || e);
    return null;
  }
}

async function generateWithHf(title, content) {
  const token = hfToken();
  if (!token) return null;
  const model =
    process.env.HUGGINGFACE_TAGS_MODEL ||
    process.env.HUGGINGFACE_SUMMARY_MODEL ||
    process.env.HUGGINGFACE_CLAIM_MODEL ||
    "meta-llama/Llama-3.2-3B-Instruct";
  const system =
    'Generate concise news tags. Return JSON only in shape {"tags":["tag one","tag two"]}. ' +
    "Use 4 to 8 lowercase tags, each 1 to 3 words, no duplicates.";
  const user = JSON.stringify({
    title: String(title || "").slice(0, 300),
    content: stripHtml(content).slice(0, 12000),
  });
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
          temperature: 0.2,
          max_tokens: 180,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;
      const parsed = raw ? JSON.parse(raw) : null;
      const tags = normalizeTags(parsed?.tags);
      if (tags.length > 0) return tags;
    } catch {
      // Continue to next endpoint.
    }
  }
  return null;
}

/**
 * @param {{ title?: string, content: string }} params
 * @returns {Promise<{ tags: string[], source: "openai" | "huggingface" | "extract" }>}
 */
async function generateArticleTags(params) {
  const title = params?.title ? String(params.title).trim() : "";
  const content = params?.content != null ? String(params.content) : "";
  const combined = filters.combineTitleBody(title, content);
  if (combined.length < 40) {
    return { tags: keywordFallback(title, content), source: "extract" };
  }

  const fromOpenAI = await generateWithOpenAI(title, content);
  if (fromOpenAI?.length) return { tags: fromOpenAI, source: "openai" };

  const fromHf = await generateWithHf(title, content);
  if (fromHf?.length) return { tags: fromHf, source: "huggingface" };

  return { tags: keywordFallback(title, content), source: "extract" };
}

module.exports = { generateArticleTags };
