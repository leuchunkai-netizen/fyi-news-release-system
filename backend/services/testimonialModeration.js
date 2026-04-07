let _openai = null;
const MODERATION_TIMEOUT_MS = Math.max(
  1500,
  Number(process.env.TESTIMONIAL_MODERATION_TIMEOUT_MS || 4500),
);

/** Minimum quality score (0–100) to auto-approve; otherwise queued pending for human review. */
const AUTO_APPROVE_MIN_SCORE = Math.max(
  0,
  Math.min(100, Number(process.env.TESTIMONIAL_AUTO_APPROVE_MIN_SCORE || 72)),
);

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    const OpenAI = require("openai");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function hfToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || null;
}

function needsRevision(reason) {
  return {
    decision: "needs_revision",
    reason,
    qualityScore: 0,
    provider: "policy",
    confidence: 1,
  };
}

function pendingReview(reason, qualityScore, provider, confidence) {
  return {
    decision: "pending_review",
    reason,
    qualityScore,
    provider,
    confidence,
  };
}

function autoApprove(reason, qualityScore, provider, confidence) {
  return {
    decision: "auto_approve",
    reason,
    qualityScore,
    provider,
    confidence,
  };
}

function basicBlocklistCheck(text) {
  const t = String(text || "").toLowerCase();
  /** Phrase-level blocks (substring OK). */
  const phrases = ["kill yourself"];
  for (const p of phrases) {
    if (t.includes(p)) {
      return needsRevision("Your testimonial contains offensive language. Please revise and try again.");
    }
  }
  /** Single-token slurs: whole-word only to avoid false positives (e.g. "retardation", "switch"). */
  const words = [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "nigger",
    "faggot",
    "retard",
  ];
  for (const w of words) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(t)) {
      return needsRevision("Your testimonial contains offensive language. Please revise and try again.");
    }
  }
  return {
    safe: true,
    provider: "blocklist",
  };
}

async function moderateWithOpenAISafety(text) {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const result = await Promise.race([
      client.moderations.create({
        model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
        input: text,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI moderation timed out")), MODERATION_TIMEOUT_MS),
      ),
    ]);
    const first = result?.results?.[0];
    if (!first) return null;
    if (first.flagged) {
      return { flagged: true };
    }
    return { flagged: false };
  } catch (e) {
    console.warn("[testimonialModeration] OpenAI safety failed:", e?.message || e);
    return null;
  }
}

async function moderateWithHfSafety(text) {
  const token = hfToken();
  if (!token) return null;
  const model = process.env.HUGGINGFACE_MODERATION_MODEL || "meta-llama/Llama-3.2-3B-Instruct";
  const prompt =
    'Classify this testimonial as SAFE or UNSAFE for public display. ' +
    "UNSAFE includes profanity, hate speech, harassment, sexual explicit content, violent threats, or self-harm encouragement. " +
    'Return strict JSON: {"label":"SAFE|UNSAFE","reason":"short reason","confidence":0-1}.\n\n' +
    `Text: ${String(text || "").slice(0, 2000)}`;

  const endpoints = [
    "https://router.huggingface.co/v1/chat/completions",
    "https://api-inference.huggingface.co/v1/chat/completions",
  ];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 220,
          temperature: 0,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(String(raw || "{}"));
      const label = String(parsed.label || "SAFE").toUpperCase();
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.6));
      if (label === "UNSAFE") {
        return { flagged: true, confidence };
      }
      return { flagged: false, confidence };
    } catch {
      // try next endpoint
    }
  }
  return null;
}

async function assessQualityScoreOpenAI(text) {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const completion = await Promise.race([
      client.chat.completions.create({
        model: process.env.OPENAI_TESTIMONIAL_QUALITY_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You score user testimonials (0-100) for public display on a news reader platform. Return JSON: {"score":number,"reason":"one short line"}. ' +
              "Score HIGH (80-100) if the text is respectful, specific about what they liked or experienced, and has enough substance (not only one or two generic words). " +
              "Score MID (45-79) if it is safe but generic, very short, or vague — still acceptable for human review. " +
              "Score LOW (0-44) only if it is spam-like, gibberish, mostly off-topic ads/URLs, or empty of real experience — still not hate/toxic (safety is handled separately).",
          },
          {
            role: "user",
            content: String(text || "").slice(0, 2000),
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI quality timed out")), MODERATION_TIMEOUT_MS),
      ),
    ]);
    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(String(raw || "{}"));
    const score = Math.round(Math.max(0, Math.min(100, Number(parsed.score) || 0)));
    return { score, reason: String(parsed.reason || "").trim() || "Quality check complete.", provider: "openai-quality" };
  } catch (e) {
    console.warn("[testimonialModeration] OpenAI quality failed:", e?.message || e);
    return null;
  }
}

function heuristicQualityScore(text) {
  const t = String(text || "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const len = t.length;
  const genericOnly =
    wc <= 4 && /^(great|good|nice|love|awesome|thanks|thank you|cool|ok|yes)$/i.test(t.replace(/[.!?,]/g, "").trim());

  if (genericOnly) return { score: 42, reason: "Very generic; we will review before showing publicly.", provider: "heuristic" };
  /** Long, multi-paragraph testimonials rarely need to sit in queue. */
  if (len >= 450 && wc >= 55) return { score: 88, reason: "Substantive long-form testimonial.", provider: "heuristic" };
  if (len >= 250 && wc >= 35) return { score: 82, reason: "Detailed testimonial.", provider: "heuristic" };
  if (len >= 120 && wc >= 18) return { score: 78, reason: "Substantive length.", provider: "heuristic" };
  if (len >= 60 && wc >= 10) return { score: 68, reason: "Moderate detail.", provider: "heuristic" };
  if (len >= 35 && wc >= 6) return { score: 52, reason: "Short but may be OK after review.", provider: "heuristic" };
  return { score: 44, reason: "On the short side; queued for review.", provider: "heuristic" };
}

async function runSafetyGate(text) {
  const o = await moderateWithOpenAISafety(text);
  if (o?.flagged) {
    return needsRevision(
      "Your testimonial includes language that violates our community standards. Please edit and resubmit.",
    );
  }
  if (o && !o.flagged) return null;

  const h = await moderateWithHfSafety(text);
  if (h?.flagged) {
    return needsRevision(
      "Your testimonial appears inappropriate for public display. Please adjust wording and try again.",
    );
  }
  if (h && !h.flagged) return null;

  const bl = basicBlocklistCheck(text);
  if (bl.safe !== true) return bl;
  return null;
}

/**
 * @returns {Promise<{ decision: 'auto_approve'|'pending_review'|'needs_revision', reason: string, qualityScore: number, provider: string, confidence: number }>}
 */
async function moderateTestimonialText(text) {
  const t = String(text || "").trim();
  if (!t) {
    return needsRevision("Testimonial message is required.");
  }
  if (t.length < 10) {
    return needsRevision("Please write a little more detail about your experience (at least one full sentence).");
  }

  const safetyBlock = await runSafetyGate(t);
  if (safetyBlock) return safetyBlock;

  const qAi = await assessQualityScoreOpenAI(t);
  const qHeu = heuristicQualityScore(t);
  let q = qHeu;
  if (qAi && qHeu) {
    const blended = Math.max(qAi.score, qHeu.score);
    q = {
      score: blended,
      reason: blended === qAi.score ? qAi.reason : qHeu.reason,
      provider: blended === qAi.score ? `${qAi.provider}+heuristic` : `heuristic+${qAi.provider}`,
    };
  } else if (qAi) q = qAi;

  const score = q.score;
  const reason =
    score >= AUTO_APPROVE_MIN_SCORE
      ? "Thanks — your testimonial met our quality bar and will show for visitors."
      : q.reason || "We received your testimonial and will review it before it appears on the site.";

  if (score >= AUTO_APPROVE_MIN_SCORE) {
    return autoApprove(reason, score, q.provider, 0.85);
  }
  return pendingReview(reason, score, q.provider, 0.7);
}

module.exports = {
  moderateTestimonialText,
  AUTO_APPROVE_MIN_SCORE,
};
