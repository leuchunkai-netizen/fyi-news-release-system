const filters = require("../utils/filters");

function skeletonClaims(title, body) {
  const text = filters.combineTitleBody(title, body);
  return [
    { claim: "Skeleton claim extracted from article text.", q: filters.sanitizeQuery(text.slice(0, 120) || "article fact check") },
    { claim: "Second skeleton claim for later verification.", q: "reliable sources news" },
  ];
}

function parseClaimsJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed.claims) ? parsed.claims : [];
    const out = arr
      .map((x) => ({
        claim: String(x.claim || "").trim(),
        q: x.q ? String(x.q).trim() : undefined,
      }))
      .filter((x) => x.claim.length > 5);
    return out.length ? out.slice(0, 8) : null;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(trimmed.slice(start, end + 1));
        const arr = Array.isArray(parsed.claims) ? parsed.claims : [];
        const out = arr
          .map((x) => ({
            claim: String(x.claim || "").trim(),
            q: x.q ? String(x.q).trim() : undefined,
          }))
          .filter((x) => x.claim.length > 5);
        return out.length ? out.slice(0, 8) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function hfToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || null;
}

/**
 * Hugging Face Inference (OpenAI-style chat when supported by router).
 */
async function hfChatClaimJson(title, body, text) {
  const token = hfToken();
  if (!token) return null;

  const model = process.env.HUGGINGFACE_CLAIM_MODEL || "meta-llama/Llama-3.2-3B-Instruct";
  const system =
    'Return ONLY valid JSON: {"claims":[{"claim":"factual claim in plain language","q":"short keywords for a news search"}]}. ' +
    "Extract 3-6 checkable factual claims. q must be short keywords, not a full sentence.";

  const user = `Title: ${title || "(none)"}\n\nBody:\n${text.slice(0, 24_000)}`;

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
          max_tokens: 1024,
          temperature: 0.2,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const parsed = parseClaimsJson(content);
      if (parsed) return parsed;
    } catch {
      /* try next endpoint */
    }
  }

  /** Legacy text-generation style (model-specific). */
  try {
    const inferUrl = `https://api-inference.huggingface.co/models/${model}`;
    const prompt = `${system}\n\n${user}\n\nJSON:`;
    const res = await fetch(inferUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 800, return_full_text: false, temperature: 0.2 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const generated = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
    const parsed = parseClaimsJson(typeof generated === "string" ? generated : JSON.stringify(data));
    return parsed;
  } catch {
    return null;
  }
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

async function openaiExtractClaims(title, body, text) {
  const client = getOpenAI();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CLAIM_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return JSON: {"claims":[{"claim":"string factual claim","q":"short search query for news"}]}. ' +
            "Extract 3-6 checkable factual claims. q should be short keywords for NewsData.io search, not a full sentence.",
        },
        {
          role: "user",
          content: `Title: ${title || "(none)"}\n\nBody:\n${text.slice(0, 24_000)}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    return parseClaimsJson(raw || "");
  } catch (e) {
    console.warn("[claimExtraction] OpenAI claim extraction failed:", e.message || e);
    return null;
  }
}

/**
 * Order: Hugging Face (claim extraction) → OpenAI fallback → skeleton.
 * Fact-check / reasoning stays in factCheckLLM (OpenAI gpt-4o-mini by default).
 * @returns {Promise<Array<{ claim: string, q?: string }>>}
 */
async function extractClaims(title, body) {
  const text = filters.combineTitleBody(title, body);

  const fromHf = await hfChatClaimJson(title, body, text);
  if (fromHf && fromHf.length) return fromHf;

  const fromOpenAi = await openaiExtractClaims(title, body, text);
  if (fromOpenAi && fromOpenAi.length) return fromOpenAi;

  return skeletonClaims(title, body);
}

module.exports = { extractClaims, skeletonClaims, hfToken };
