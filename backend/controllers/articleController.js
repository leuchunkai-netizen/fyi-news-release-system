const { runFactcheckPipeline } = require("../services/articlePipeline");
const { generateArticleSummary, summaryContentHash } = require("../services/articleSummary");
const { generateArticleTags } = require("../services/articleTags");
const articleQueries = require("../db/articleQueries");
const { upsertCredibilityFromFactcheck } = require("../db/credibilityQueries");
const { getSupabaseAdmin } = require("../db/supabaseClient");
const { getUserFromBearer } = require("../utils/supabaseAuth");
const { evaluateClaimAgainstSource, finalDecisionFromSignals } = require("../services/sourceVerification");

function tokenizeForRelevance(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

function checkLooksRelevantToClaims(check, claims) {
  const claimText = String(check?.claim || "");
  const sourceText = `${String(check?.sourceTitle || "")} ${String(check?.reason || "")}`.toLowerCase();
  const claimsList = Array.isArray(claims) ? claims : [];
  if (claimText) {
    const hasExact = claimsList.some((c) => String(c?.claim || "").trim() === claimText.trim());
    if (hasExact) return true;
  }
  const srcTokens = new Set(tokenizeForRelevance(sourceText));
  if (srcTokens.size === 0) return false;
  for (const c of claimsList) {
    const claimTokens = tokenizeForRelevance(c?.claim || "");
    let hits = 0;
    for (const t of claimTokens) {
      if (srcTokens.has(t)) hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

async function listArticles(req, res) {
  try {
    const limit = Number(req.query.limit) || 20;
    const result = await articleQueries.listPublishedArticles(limit);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Failed to list articles" });
  }
}

/**
 * POST /api/articles/factcheck
 *
 * Pipeline: length → garbage → (rate limit on route) → claim extraction →
 * NewsData (BBC/CNA/Reuters by default) → optional pgvector → embeddings + rank → top 3 → OpenAI.
 */
async function factcheck(req, res) {
  try {
    const { title, body, articleId } = req.body || {};
    const result = await runFactcheckPipeline({ title, body });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        error: result.error,
        stage: result.stage,
      });
    }

    let credibilitySaved = false;
    let credibilitySaveError = null;
    if (articleId && typeof articleId === "string") {
      const save = await upsertCredibilityFromFactcheck(articleId, result);
      credibilitySaved = save.ok;
      credibilitySaveError = save.ok ? null : save.error;
    }

    res.json({
      ...result.fc,
      claimsList: result.claims,
      top3: result.top3,
      credibilitySaved,
      credibilitySaveError,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Factcheck failed" });
  }
}

/**
 * POST /api/articles/summary — AI/HF summary from title + body (not user excerpt).
 * With `articleId` + service role: load article from DB, return cached row if content hash matches, else generate once and persist.
 */
async function summarize(req, res) {
  try {
    const { articleId, title, content } = req.body || {};
    const sb = getSupabaseAdmin();

    if (articleId && typeof articleId === "string" && !sb) {
      console.warn(
        "[summary] SUPABASE_SERVICE_ROLE_KEY missing — cannot read/save article row. Put the key in backend/.env or project root .env and restart the API."
      );
      if (content == null || String(content).trim().length === 0) {
        return res.status(503).json({
          error:
            "Server cannot save the summary without Supabase service role. Add SUPABASE_SERVICE_ROLE_KEY to backend/.env (same project) and restart the API.",
          persisted: false,
        });
      }
      const result = await generateArticleSummary({ title, content });
      return res.json({
        ...result,
        cached: false,
        persisted: false,
        persistHint:
          "Summary was generated but not stored: set SUPABASE_SERVICE_ROLE_KEY in backend/.env and restart the API.",
      });
    }

    if (articleId && typeof articleId === "string" && sb) {
      const { data: row, error: fetchErr } = await sb
        .from("articles")
        .select("id, title, content, ai_summary, ai_summary_source, ai_summary_content_hash")
        .eq("id", articleId)
        .maybeSingle();

      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!row) return res.status(404).json({ error: "Article not found" });

      const t = row.title ?? "";
      const c = row.content ?? "";
      if (!String(c).trim()) {
        return res.status(400).json({ error: "Article has no content" });
      }

      const hash = summaryContentHash(t, c);
      if (row.ai_summary && row.ai_summary_content_hash === hash) {
        return res.json({
          summary: row.ai_summary,
          source: row.ai_summary_source || "extract",
          cached: true,
          persisted: true,
        });
      }

      const result = await generateArticleSummary({ title: t, content: c });
      const { data: updated, error: upErr } = await sb
        .from("articles")
        .update({
          ai_summary: result.summary,
          ai_summary_source: result.source,
          ai_summary_content_hash: hash,
        })
        .eq("id", articleId)
        .select("id")
        .maybeSingle();

      if (upErr) return res.status(500).json({ error: upErr.message });
      if (!updated) {
        return res.status(500).json({
          error: "Summary was generated but the database update affected no rows (check article id and RLS/service role).",
        });
      }
      return res.json({ ...result, cached: false, persisted: true });
    }

    if (content == null || String(content).trim().length === 0) {
      return res.status(400).json({ error: "Missing content" });
    }
    const result = await generateArticleSummary({ title, content });
    res.json({ ...result, cached: false, persisted: false });
  } catch (e) {
    res.status(500).json({ error: e.message || "Summary failed" });
  }
}

/**
 * POST /api/articles/tags — auto-generate related tags from title + body.
 */
async function suggestTags(req, res) {
  try {
    const { title, content } = req.body || {};
    if (content == null || String(content).trim().length === 0) {
      return res.status(400).json({ error: "Missing content. Add article text before generating tags." });
    }
    const result = await generateArticleTags({ title, content });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Tag generation failed" });
  }
}

/**
 * POST /api/articles/submit-review
 * After the client saves the article as pending, call this with the same title/body.
 * Runs the fact-check pipeline; if verdict + confidence pass env thresholds, publishes automatically.
 */
async function submitForReview(req, res) {
  try {
    const user = await getUserFromBearer(req);
    if (!user) {
      return res.status(401).json({ error: "Sign in required, or configure SUPABASE_ANON_KEY on the API server." });
    }

    const { articleId, title, body, userSourceChecks, pipelineConfidence: clientPipelineConfidence } = req.body || {};
    if (!articleId || typeof articleId !== "string") {
      return res.status(400).json({ error: "Missing articleId" });
    }
    if (body == null || String(body).trim().length === 0) {
      return res.status(400).json({ error: "Missing body" });
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(503).json({ error: "Server cannot update articles (Supabase service role not configured)." });
    }

    const { data: article, error: fetchErr } = await sb
      .from("articles")
      .select("id, author_id, status")
      .eq("id", articleId)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (article.author_id !== user.id) {
      return res.status(403).json({ error: "You can only submit your own articles" });
    }

    const result = await runFactcheckPipeline({ title, body });
    if (!result.ok) {
      return res.status(400).json({
        error: result.error,
        stage: result.stage,
      });
    }

    const minConf = Number(process.env.AUTO_APPROVE_MIN_CONFIDENCE ?? 70);
    const allowedVerdicts = (process.env.AUTO_APPROVE_VERDICTS || "VERIFIED,UNCERTAIN")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const baseVerdict = String(result.fc.verdict || "UNCERTAIN").toUpperCase();
    const serverBaseConfidence = Math.max(0, Math.min(100, Number(result.fc.confidence) || 0));
    /** Match the score shown in the editor: authors send the confidence from their last "Run fact check" so a second LLM run cannot swap 81% for 49%. */
    const parsedClient =
      clientPipelineConfidence != null && Number.isFinite(Number(clientPipelineConfidence))
        ? Math.max(0, Math.min(100, Math.round(Number(clientPipelineConfidence))))
        : null;
    const baseConfidence = parsedClient != null ? parsedClient : serverBaseConfidence;
    const checksRaw = Array.isArray(userSourceChecks) ? userSourceChecks : [];
    let checks = checksRaw.filter((c) => checkLooksRelevantToClaims(c, result.fc.claims));
    // Second pipeline run can extract slightly different claim strings; if nothing matches, still count client checks for bonuses.
    if (checks.length === 0 && checksRaw.length > 0) {
      checks = checksRaw;
    }
    const supportHigh = checks.filter((c) => c?.aiVerdict === "SUPPORT" && c?.sourceCredibility === "HIGH").length;
    const supportLow = checks.filter((c) => c?.aiVerdict === "SUPPORT" && c?.sourceCredibility === "LOW").length;
    const contradicts = checks.filter((c) => c?.aiVerdict === "CONTRADICT").length;
    // User source checks can only boost confidence; contradicting sources still affect verdict below, not the score.
    let confidence = baseConfidence + Math.min(15, supportHigh * 5) + Math.min(6, supportLow * 2);
    confidence = Math.max(0, Math.min(100, confidence));
    const verifiedScoreThreshold = 75;
    let verdict = baseVerdict;
    if (contradicts > 0) {
      verdict = "REJECTED";
    } else if (confidence >= verifiedScoreThreshold) {
      verdict = "VERIFIED";
    } else if (supportHigh >= 2) {
      verdict = "VERIFIED";
    } else if ((supportHigh > 0 || supportLow > 0) && verdict === "REJECTED") {
      verdict = "UNCERTAIN";
    }

    const saveCred = await upsertCredibilityFromFactcheck(articleId, result, {
      userSourceChecks: checks,
      scoreOverride: Math.round(confidence),
      verdictOverride: verdict,
    });
    const credibilitySaveError = saveCred.ok ? null : saveCred.error;

    const verdictOk = allowedVerdicts.includes(verdict);
    const confidenceOk = confidence >= minConf;
    const autoApproved = verdictOk && confidenceOk && verdict !== "REJECTED";

    const score = Math.round(confidence);

    if (autoApproved) {
      const { error: upErr } = await sb
        .from("articles")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          credibility_score: score,
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", articleId);
      if (upErr) return res.status(500).json({ error: upErr.message });
    } else {
      const { error: upErr } = await sb
        .from("articles")
        .update({
          status: "pending",
          credibility_score: score,
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", articleId);
      if (upErr) return res.status(500).json({ error: upErr.message });
    }

    res.json({
      autoApproved,
      verdict,
      confidence,
      baseVerdict,
      baseConfidence,
      serverBaseConfidence,
      usedClientPipelineConfidence: parsedClient != null,
      minConfidence: minConf,
      allowedVerdicts,
      credibilitySaved: saveCred.ok,
      credibilitySaveError,
      sourceEvidenceSummary: {
        totalChecks: checks.length,
        ignoredChecks: checksRaw.length - checks.length,
        supportHigh,
        supportLow,
        contradicts,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Submit review failed" });
  }
}

/**
 * POST /api/articles/verify-claim-source
 * Verifies one claim against one user-supplied source URL.
 */
async function verifyClaimSource(req, res) {
  try {
    const { claim, sourceUrl, priorSignals } = req.body || {};
    if (!claim || typeof claim !== "string") {
      return res.status(400).json({ error: "Missing claim" });
    }
    if (!sourceUrl || typeof sourceUrl !== "string") {
      return res.status(400).json({ error: "Missing sourceUrl" });
    }
    const result = await evaluateClaimAgainstSource({ claim, url: sourceUrl });
    const signalRows = [...(Array.isArray(priorSignals) ? priorSignals : []), result.signal];
    const finalDecision = finalDecisionFromSignals(signalRows);
    return res.json({
      ...result,
      finalDecision,
      signalCount: signalRows.length,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Source verification failed" });
  }
}

module.exports = {
  listArticles,
  factcheck,
  summarize,
  suggestTags,
  submitForReview,
  verifyClaimSource,
};
