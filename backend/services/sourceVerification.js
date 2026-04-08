const OpenAI = require("openai");
const { parseTrustedDomains, hostMatchesTrusted } = require("./newsSearch");

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Missing source URL");
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed.");
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) {
    throw new Error("Local/private URLs are not allowed.");
  }
  return u.toString();
}

async function fetchSourceText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "FYI-News-Release-System/1.0",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  let html = "";
  if (res.ok) {
    html = await res.text();
  } else {
    // Fallback reader for anti-bot/news sites that block direct server fetches.
    const readerRes = await fetch(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`);
    if (readerRes.ok) {
      const readerText = await readerRes.text();
      html = `<title>Reader Mirror</title><body>${readerText}</body>`;
    } else {
      const rss = await fetchGoogleRssFallback(url);
      if (!rss) {
        throw new Error(`Failed to fetch source URL (${res.status}); reader fallback also failed (${readerRes.status}).`);
      }
      html = `<title>${rss.title}</title><body>${rss.text}</body>`;
    }
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = String(titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
  if (text.length < 80) {
    throw new Error("Source page did not contain enough readable text.");
  }
  return { title, text };
}

function extractSearchTermsFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const bits = u.pathname
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .replace(/[-_]/g, " ");
    return `${host} ${bits}`.trim();
  } catch {
    return "news";
  }
}

async function fetchGoogleRssFallback(url) {
  const q = extractSearchTermsFromUrl(url);
  const rss = new URL("https://news.google.com/rss/search");
  rss.searchParams.set("q", q);
  rss.searchParams.set("hl", "en-US");
  rss.searchParams.set("gl", "US");
  rss.searchParams.set("ceid", "US:en");
  try {
    const res = await fetch(rss.toString());
    const xml = await res.text();
    if (!res.ok || !xml) return null;
    const firstItem = (xml.match(/<item>[\s\S]*?<\/item>/i) || [])[0];
    if (!firstItem) return null;
    const title = ((firstItem.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/<[^>]*>/g, "").trim();
    const desc = ((firstItem.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title && !desc) return null;
    return { title: title || "Google News result", text: `${title}. ${desc}`.slice(0, 12000) };
  } catch {
    return null;
  }
}

function resolveSourceCredibility(url) {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  const trusted = parseTrustedDomains();
  return hostMatchesTrusted(host, trusted) ? "HIGH" : "LOW";
}

function finalDecisionFromSignals(signals) {
  const rows = Array.isArray(signals) ? signals : [];
  const supports = rows.filter((s) => s.verdict === "SUPPORT" && s.credibility === "HIGH").length;
  const contradicts = rows.filter((s) => s.verdict === "CONTRADICT").length;
  if (contradicts > 0) return "REJECTED";
  if (supports >= 2) return "VERIFIED";
  return "UNCERTAIN";
}

async function evaluateClaimAgainstSource({ claim, url }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const cleanClaim = String(claim || "").trim();
  if (!cleanClaim) throw new Error("Missing claim");
  const normalizedUrl = normalizeUrl(url);
  const source = await fetchSourceText(normalizedUrl);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_FACTCHECK_MODEL || "gpt-4o-mini";
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          'You verify one claim against one source text. Output strict JSON: {"aiVerdict":"SUPPORT|CONTRADICT|UNRELATED","confidence":0-100,"reason":"short reason","evidenceQuote":"short exact quote from source text or empty"}',
      },
      {
        role: "user",
        content: JSON.stringify({
          claim: cleanClaim,
          sourceUrl: normalizedUrl,
          sourceTitle: source.title,
          sourceText: source.text,
        }),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No verification output from model.");
  const parsed = JSON.parse(raw);
  const aiVerdict = ["SUPPORT", "CONTRADICT", "UNRELATED"].includes(String(parsed.aiVerdict).toUpperCase())
    ? String(parsed.aiVerdict).toUpperCase()
    : "UNRELATED";
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  const reason = String(parsed.reason || "").trim() || "No explanation returned.";
  const evidenceQuote = String(parsed.evidenceQuote || "").trim().slice(0, 400);
  const sourceCredibility = resolveSourceCredibility(normalizedUrl);
  return {
    url: normalizedUrl,
    sourceTitle: source.title || "Untitled source",
    sourceCredibility,
    aiVerdict,
    confidence,
    reason,
    evidenceQuote,
    signal: { verdict: aiVerdict, credibility: sourceCredibility },
  };
}

module.exports = {
  evaluateClaimAgainstSource,
  finalDecisionFromSignals,
};

