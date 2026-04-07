let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    const OpenAI = require("openai");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function skeletonResult(claims, evidence) {
  const claimList = Array.isArray(claims) ? claims : [];
  return {
    claims: claimList.map((c) => ({
      claim: c.claim ?? String(c),
      verdict: "UNVERIFIED",
      why: "Skeleton mode: set OPENAI_API_KEY for GPT-4o-mini fact-check reasoning.",
    })),
    confidence: 50,
    verdict: "UNCERTAIN",
    summary: "Skeleton mode: no LLM fact-check performed.",
    evidenceUsed: Array.isArray(evidence) ? evidence.slice(0, 3) : [],
  };
}

/**
 * @param {Array<{ claim?: string, q?: string }>} claims
 * @param {Array<{ title?: string, source?: string, desc?: string, forClaim?: string }>} evidence
 */
async function evaluateClaims(claims, evidence) {
  /** At most 3 evidence items (embedding-ranked) are sent to the model. */
  const evidenceTop = (evidence || []).slice(0, 3);

  const client = getOpenAI();
  if (!client) return skeletonResult(claims, evidenceTop);
  const payload = {
    claims: (claims || []).map((c) => ({ claim: c.claim ?? String(c) })),
    evidence: evidenceTop.map((e, i) => ({
      id: i + 1,
      title: e.title,
      source: e.source,
      desc: e.desc,
      forClaim: e.forClaim,
    })),
  };

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_FACTCHECK_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a careful fact-checking assistant. Use ONLY the evidence snippets provided. " +
          'Return JSON with shape: {"claims":[{"claim":"...","verdict":"SUPPORTED|DISPUTED|UNVERIFIED","why":"..."}],' +
          '"confidence":0-100,"verdict":"VERIFIED|UNCERTAIN|REJECTED","summary":"short paragraph"}. ' +
          "If evidence is insufficient, use UNVERIFIED and lower confidence.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) return skeletonResult(claims, evidenceTop);
  try {
    const parsed = JSON.parse(raw);
    const claimResults = Array.isArray(parsed.claims) ? parsed.claims : [];
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 50;
    const verdict = ["VERIFIED", "UNCERTAIN", "REJECTED"].includes(parsed.verdict) ? parsed.verdict : "UNCERTAIN";
    const summary = String(parsed.summary || "").trim() || "No summary returned.";
    const normalized = claimResults.map((row, i) => {
      const c = claims[i];
      const claimText = row.claim || (c && c.claim) || String(c || "");
      let v = String(row.verdict || "UNVERIFIED").toUpperCase();
      if (!["SUPPORTED", "DISPUTED", "UNVERIFIED"].includes(v)) v = "UNVERIFIED";
      return { claim: claimText, verdict: v, why: String(row.why || "").slice(0, 2000) };
    });
    return {
      claims: normalized.length ? normalized : skeletonResult(claims, evidenceTop).claims,
      confidence: Math.max(0, Math.min(100, confidence)),
      verdict,
      summary,
      evidenceUsed: evidenceTop,
    };
  } catch {
    return skeletonResult(claims, evidenceTop);
  }
}

module.exports = { evaluateClaims, skeletonResult };
