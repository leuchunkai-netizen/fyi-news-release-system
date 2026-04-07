/**
 * Orchestrates the submission → fact-check flow:
 *
 * length → garbage → (rate limit on Express route) → claim extraction →
 * trusted news (NewsData) → optional pgvector corpus → embed + rank evidence →
 * top 3 → OpenAI fact-check + confidence
 */

const claimExtraction = require("./claimExtraction");
const newsSearch = require("./newsSearch");
const embeddingService = require("./embeddingService");
const factCheckLLM = require("./factCheckLLM");
const filters = require("../utils/filters");
const vectorQueries = require("../db/vectorQueries");

const TOP_EVIDENCE_FOR_LLM = 3;

function evidenceDedupeKey(e) {
  return `${e.title}|${e.source}|${String(e.desc || "").slice(0, 80)}`;
}

async function mergePgvectorCorpusEvidence(claims, evidence) {
  if (!process.env.PGVECTOR_MATCH_RPC) return evidence;
  const q = claims.map((c) => c.claim).join(" ");
  const qVec = await embeddingService.embedText(q);
  const expectedDim = Number(process.env.PGVECTOR_EMBEDDING_DIM || 1536);
  if (!qVec || qVec.length !== expectedDim) {
    return evidence;
  }

  const matchCount = Number(process.env.PGVECTOR_MATCH_COUNT || 6);
  const rows = await vectorQueries.matchCorpusChunks(qVec, matchCount);
  if (!rows.length) return evidence;

  const seen = new Set(evidence.map(evidenceDedupeKey));
  const out = [...evidence];
  for (const r of rows) {
    const item = {
      title: r.title || "Corpus",
      source: r.source || "pgvector",
      desc: String(r.content || "").slice(0, 500),
      forClaim: "",
    };
    const k = evidenceDedupeKey(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * @param {{ title?: string, body: string }} params
 * @returns {Promise<{ ok: true, claims, evidenceTop3, fc } | { ok: false, error: string, stage?: string, status?: number }>}
 */
async function runFactcheckPipeline(params) {
  const { title, body } = params || {};
  const gate = filters.validateForFactcheckPipeline(title, body);
  if (!gate.ok) {
    return { ok: false, error: gate.error, stage: gate.stage, status: 400 };
  }

  const claims = await claimExtraction.extractClaims(title, body);

  let evidence = await newsSearch.searchForClaims(claims, { trustedDomainsOnly: true });

  evidence = await mergePgvectorCorpusEvidence(claims, evidence);

  if (embeddingService.hasEmbeddingProvider() && evidence.length > 1) {
    const query = claims.map((c) => c.claim).join(" ");
    try {
      evidence = await embeddingService.rerankEvidenceByQuery(query, evidence);
    } catch {
      /* keep API order */
    }
  }

  const evidenceTop3 = evidence.slice(0, TOP_EVIDENCE_FOR_LLM);

  const fc = await factCheckLLM.evaluateClaims(claims, evidenceTop3);

  return {
    ok: true,
    claims,
    evidenceTop3,
    fc,
    top3: evidenceTop3,
  };
}

module.exports = {
  runFactcheckPipeline,
  mergePgvectorCorpusEvidence,
  TOP_EVIDENCE_FOR_LLM,
};
