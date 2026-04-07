/**
 * Embeddings for: query string + each evidence snippet (title/desc/source blob),
 * then cosine similarity to rank evidence before the top 3 are sent to OpenAI.
 */
const { cosineSimilarity } = require("../utils/similarity");

function hfToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || null;
}

function hasEmbeddingProvider() {
  return Boolean(process.env.OPENAI_API_KEY || hfToken());
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

/**
 * Mean-pool token embeddings from HF feature-extraction style responses.
 */
function meanPoolTokenEmbeddings(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (typeof rows[0] === "number") return rows;
  if (!Array.isArray(rows[0])) return null;
  const dim = rows[0].length;
  const sum = new Array(dim).fill(0);
  let n = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== dim) continue;
    for (let i = 0; i < dim; i++) sum[i] += row[i];
    n++;
  }
  return n ? sum.map((s) => s / n) : null;
}

/**
 * Hugging Face Inference embeddings (384-d typical for MiniLM). In-memory ranking only unless you align pgvector dim.
 */
async function hfEmbedText(text) {
  const token = hfToken();
  if (!token) return null;

  const model =
    process.env.HUGGINGFACE_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
  const input = String(text || "").slice(0, 8000);
  if (!input.trim()) return null;

  const url = `https://api-inference.huggingface.co/models/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: input }),
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;

  if (Array.isArray(data) && Array.isArray(data[0])) {
    return meanPoolTokenEmbeddings(data);
  }
  if (Array.isArray(data) && typeof data[0] === "number") {
    return data;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function embedText(text) {
  const client = getOpenAI();
  if (client) {
    const input = String(text || "").slice(0, 8000);
    if (!input.trim()) return null;
    const res = await client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input,
    });
    return res.data[0]?.embedding ?? null;
  }
  return hfEmbedText(text);
}

/**
 * Rerank evidence by cosine similarity to the query embedding (OpenAI or HF).
 * @param {string} query
 * @param {Array<{ title?: string, desc?: string, source?: string, forClaim?: string }>} items
 */
async function rerankEvidenceByQuery(query, items) {
  if (!items.length) return items;
  const qVec = await embedText(query);
  if (!qVec) return items;

  const scored = [];
  for (const item of items) {
    const blob = [item.title, item.desc, item.source].filter(Boolean).join(" ");
    const v = await embedText(blob);
    const score = v && v.length === qVec.length ? cosineSimilarity(qVec, v) : 0;
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

module.exports = {
  embedText,
  rerankEvidenceByQuery,
  hasEmbeddingProvider,
  hfEmbedText,
};
