const { getSupabaseAdmin } = require("./supabaseClient");
const { mapPipelineToCredibilityRow } = require("../services/credibilityFromFactcheck");

/**
 * Upsert credibility analysis from a completed fact-check pipeline run.
 * @param {string} articleId
 * @param {{ ok: true, fc: object, claims: array, top3: array }} pipelineResult
 * @param {{ userSourceChecks?: Array<object>, scoreOverride?: number, verdictOverride?: string }} [options]
 */
async function upsertCredibilityFromFactcheck(articleId, pipelineResult, options = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return { ok: false, error: "Supabase service role not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." };
  }

  const { data: art, error: fetchErr } = await sb.from("articles").select("id").eq("id", articleId).maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!art) return { ok: false, error: "Article not found" };

  const row = mapPipelineToCredibilityRow(
    pipelineResult.fc,
    pipelineResult.claims,
    pipelineResult.top3,
    options.userSourceChecks,
    options
  );

  const { error } = await sb.from("article_credibility_analysis").upsert(
    {
      article_id: articleId,
      ...row,
      strengths: row.strengths,
      concerns: row.concerns,
      warnings: row.warnings,
      evidence_snippets: row.evidence_snippets ?? [],
    },
    { onConflict: "article_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, row };
}

module.exports = { upsertCredibilityFromFactcheck };
