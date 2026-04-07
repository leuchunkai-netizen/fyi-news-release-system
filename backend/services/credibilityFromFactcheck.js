/**
 * Map fact-check pipeline output → article_credibility_analysis row (Supabase).
 */
function isMockEvidenceItem(e) {
  if (!e) return true;
  const s = String(e.source || "").toLowerCase();
  if (s === "example.com" || s === "example.org") return true;
  return String(e.desc || "").includes("Placeholder");
}

/**
 * @param {*} fc fact-check LLM result
 * @param {Array<{ claim?: string, q?: string }>} _claimsList unused; reserved for future weighting
 * @param {Array<{ title?: string, source?: string, desc?: string }>} top3
 */
function mapPipelineToCredibilityRow(fc, _claimsList, top3) {
  const confidence = Math.max(0, Math.min(100, typeof fc.confidence === "number" ? fc.confidence : 50));
  const verdict = fc.verdict || "UNCERTAIN";
  const claimRows = Array.isArray(fc.claims) ? fc.claims : [];

  const supported = claimRows.filter((c) => c.verdict === "SUPPORTED").length;
  const disputed = claimRows.filter((c) => c.verdict === "DISPUTED").length;
  const total = Math.max(claimRows.length, 1);
  const factualAccuracy = Math.round((supported / total) * 100);

  const evidence = Array.isArray(top3) ? top3 : [];
  const mockCount = evidence.filter(isMockEvidenceItem).length;
  const sourceQuality =
    evidence.length === 0
      ? Math.max(30, confidence - 20)
      : Math.round(100 - (mockCount / evidence.length) * 45);

  const citationsScore = Math.min(100, evidence.length * 34);

  const strengths = [];
  if (supported > 0) strengths.push(`${supported} of ${total} checked claim(s) supported by retrieved evidence.`);
  if (verdict === "VERIFIED") strengths.push("Overall verdict: verified against the evidence provided.");
  const summaryLine = String(fc.summary || "").trim();
  if (summaryLine) strengths.push(summaryLine.slice(0, 400));

  const concerns = [];
  claimRows
    .filter((c) => c.verdict === "UNVERIFIED" || c.verdict === "DISPUTED")
    .forEach((c) => {
      const line = `${c.claim}: ${c.why || c.verdict}`.trim();
      if (line.length > 5) concerns.push(line.slice(0, 500));
    });
  if (concerns.length === 0 && verdict === "UNCERTAIN") {
    concerns.push("Several claims could not be fully verified with the available evidence.");
  }

  const warnings = [];
  if (verdict === "REJECTED") warnings.push("Automated fact-check: rejected relative to supplied evidence.");
  if (confidence < 35) warnings.push("Low confidence in this automated assessment.");
  if (mockCount > 0 && evidence.length > 0) {
    warnings.push("Some evidence slots used placeholder or mock sources; widen NewsData queries or domains.");
  }

  return {
    score: confidence,
    source_quality: Math.max(0, Math.min(100, sourceQuality)),
    factual_accuracy: Math.max(0, Math.min(100, factualAccuracy)),
    expert_review_score: null,
    citations_score: Math.max(0, Math.min(100, citationsScore)),
    author_credibility_score: null,
    strengths: strengths.filter(Boolean).slice(0, 12),
    concerns: concerns.slice(0, 12),
    warnings: warnings.slice(0, 12),
  };
}

module.exports = { mapPipelineToCredibilityRow, isMockEvidenceItem };
