/**
 * Map fact-check pipeline output → article_credibility_analysis row (Supabase).
 */
function isMockEvidenceItem(e) {
  if (!e) return true;
  const s = String(e.source || "").toLowerCase();
  if (s === "example.com" || s === "example.org") return true;
  return String(e.desc || "").includes("Placeholder");
}

/** Persist pipeline evidence for readers (matches upload page "Evidence snippets used"). */
function serializeEvidenceSnippets(top3) {
  const arr = Array.isArray(top3) ? top3 : [];
  return arr.map((e) => ({
    title: String(e?.title ?? "").slice(0, 500),
    source: String(e?.source ?? "").slice(0, 200),
    desc: String(e?.desc ?? "").slice(0, 2000),
    ...(typeof e?.link === "string" && e.link.trim() ? { link: e.link.trim().slice(0, 2000) } : {}),
  }));
}

/**
 * @param {*} fc fact-check LLM result
 * @param {Array<{ claim?: string, q?: string }>} _claimsList unused; reserved for future weighting
 * @param {Array<{ title?: string, source?: string, desc?: string }>} top3
 */
function mapPipelineToCredibilityRow(fc, _claimsList, top3, userSourceChecks = [], options = {}) {
  const baseConfidence = Math.max(0, Math.min(100, typeof fc.confidence === "number" ? fc.confidence : 50));
  const confidence = Math.max(0, Math.min(100, Number(options.scoreOverride ?? baseConfidence)));
  const verdict = String(options.verdictOverride || fc.verdict || "UNCERTAIN").toUpperCase();
  const rawClaimRows = Array.isArray(fc.claims) ? fc.claims : [];
  const submitted = Array.isArray(userSourceChecks) ? userSourceChecks : [];

  const claimOverride = new Map();
  for (const s of submitted) {
    const claim = String(s?.claim || "").trim();
    if (!claim) continue;
    const aiVerdict = String(s?.aiVerdict || "").toUpperCase();
    if (aiVerdict === "CONTRADICT") {
      claimOverride.set(claim, "DISPUTED");
      continue;
    }
    if (aiVerdict === "SUPPORT" && String(s?.sourceCredibility || "").toUpperCase() === "HIGH") {
      // High-cred support should mark that claim as supported in saved analysis.
      claimOverride.set(claim, "SUPPORTED");
    }
  }

  const claimRows = rawClaimRows.map((c) => {
    const claim = String(c?.claim || "").trim();
    const overrideVerdict = claimOverride.get(claim);
    return overrideVerdict ? { ...c, verdict: overrideVerdict } : c;
  });

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

  /** Snippets shown on the article page: same rows the LLM used (factCheckLLM `evidenceUsed`), else pipeline top slice. */
  const evidenceForDisplay =
    Array.isArray(fc?.evidenceUsed) && fc.evidenceUsed.length > 0 ? fc.evidenceUsed : evidence;

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

  /** Only surface SUPPORT checks in saved analysis text (omit UNRELATED, CONTRADICT). */
  const supportOnlySubmitted = submitted.filter((s) => String(s?.aiVerdict || "").toUpperCase() === "SUPPORT");
  const showSources = supportOnlySubmitted.slice(0, 6);
  if (showSources.length > 0) {
    strengths.push(`User submitted ${showSources.length} supporting source link(s) for re-check.`);
    for (const s of showSources) {
      const titleOrUrl = String(s.sourceTitle || s.sourceUrl || "User source");
      const line = `SUPPORT (${String(s.sourceCredibility || "LOW")}): ${titleOrUrl}`;
      strengths.push(line.slice(0, 500));
    }
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
    evidence_snippets: serializeEvidenceSnippets(evidenceForDisplay),
  };
}

module.exports = { mapPipelineToCredibilityRow, isMockEvidenceItem };
