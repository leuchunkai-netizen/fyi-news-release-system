const filters = require("../utils/filters");

/** Default trusted outlets; override with EVIDENCE_DOMAINS in env. */
const DEFAULT_EVIDENCE_DOMAINS = [
  "bbc.co.uk",
  "bbc.com",
  "channelnewsasia.com",
  "reuters.com",
  "apnews.com",
  "ft.com",
];

const NEWS_REQUEST_TIMEOUT_MS = Math.max(
  1500,
  Number(process.env.NEWS_REQUEST_TIMEOUT_MS || 4500),
);

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseTrustedDomains() {
  const raw = process.env.EVIDENCE_DOMAINS || DEFAULT_EVIDENCE_DOMAINS.join(",");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

/**
 * NewsData.io `domainurl` must use domains registered in their catalog.
 * `bbc.co.uk` invalidates the whole request; map to `bbc.com`. See newsdata.io/news-sources.
 * @param {string[]} trustedDomains hostnames from EVIDENCE_DOMAINS
 * @returns {string[]} deduped, max 5
 */
function domainsForNewsDataDomainurl(trustedDomains) {
  const map = {
    "bbc.co.uk": "bbc.com",
    "bbc.com": "bbc.com",
    "channelnewsasia.com": "channelnewsasia.com",
    "reuters.com": "reuters.com",
  };
  const out = [];
  const seen = new Set();
  for (const d of trustedDomains || []) {
    const h = String(d || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (!h) continue;
    const mapped = map[h] || (h.includes(".") ? h : null);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
    if (out.length >= 5) break;
  }
  return out;
}

function hostFromLink(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * @param {string} host normalized hostname without www
 * @param {string[]} trusted
 */
function hostMatchesTrusted(host, trusted) {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  for (const d of trusted) {
    if (h === d || h.endsWith("." + d)) return true;
  }
  return false;
}

function mapArticleToEvidence(art, forClaim) {
  const title = art.title || "Untitled";
  const desc = art.description || art.content || "";
  const link = art.link || "";
  const host = hostFromLink(link) || "unknown";
  return {
    title,
    source: host,
    desc: String(desc).slice(0, 500),
    forClaim,
    link,
  };
}

/**
 * Keep only rows whose article URL host is in the trusted list (BBC / CNA / Reuters by default).
 */
function filterTrustedEvidence(items, trusted) {
  return items.filter((e) => hostMatchesTrusted(e.source, trusted));
}

function buildNewsDataQuery(q, forClaim) {
  const raw = String(q || "").trim() || String(forClaim || "").trim() || "news";
  const sanitized = filters.sanitizeQuery(raw);
  const trimmed = sanitized.trim();
  if (trimmed.length >= 3) return trimmed.slice(0, 200);
  return "news";
}

/** Shorter keyword phrases when the full query returns zero hits in NewsData (common for long claim strings). */
function broadenQueryVariants(query) {
  const q = String(query || "").trim();
  const words = q.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const out = [];
  const add = (s) => {
    const t = filters.sanitizeQuery(String(s || "").trim()).slice(0, 200).trim();
    if (t.length < 3) return;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  add(q);
  for (const n of [12, 10, 8, 6, 4, 3, 2]) {
    if (words.length >= n) add(words.slice(0, n).join(" "));
  }
  return out;
}

function extractQuerySignals(text) {
  const t = String(text || "");
  const out = [];
  const seen = new Set();
  const add = (s) => {
    const q = filters.sanitizeQuery(String(s || "").trim()).slice(0, 200).trim();
    if (q.length < 3 || seen.has(q)) return;
    seen.add(q);
    out.push(q);
  };

  const entityMatches = t.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) || [];
  for (const e of entityMatches.slice(0, 4)) add(e);

  const yearMatch = t.match(/\b(19|20)\d{2}\b/g) || [];
  for (const y of yearMatch.slice(0, 2)) add(`news ${y}`);

  const percentMatches = t.match(/\b\d+(?:\.\d+)?\s?%/g) || [];
  for (const p of percentMatches.slice(0, 2)) add(`rate ${p}`);

  const locationMatches = t.match(/\b(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g) || [];
  for (const loc of locationMatches.slice(0, 3)) {
    add(loc.replace(/^(in|at|from)\s+/i, ""));
  }
  return out;
}

function detectClaimAnchor(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const entities = t.match(/\b[A-Z][A-Za-z0-9-]{2,}(?:\s+[A-Z][A-Za-z0-9-]{2,}){0,2}\b/g) || [];
  if (entities.length) return entities[0];
  const words = t.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  return words.find((w) => /^[A-Za-z][A-Za-z0-9-]{5,}$/.test(w)) || "";
}

function claimQueryVariants(claimText, q) {
  const claim = String(claimText || "").trim();
  const base = String(q || "").trim() || claim;
  const anchor = detectClaimAnchor(claim) || detectClaimAnchor(base);
  const out = [];
  const seen = new Set();
  const add = (s) => {
    const v = filters.sanitizeQuery(String(s || "").trim()).slice(0, 200).trim();
    if (v.length < 3 || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  add(base);
  add(claim);
  for (const v of broadenQueryVariants(base)) add(v);
  for (const v of broadenQueryVariants(claim)) add(v);
  for (const v of extractQuerySignals(claim)) add(v);
  if (anchor) {
    const anchored = [];
    for (const v of out) {
      if (v.toLowerCase().includes(anchor.toLowerCase())) {
        anchored.push(v);
        continue;
      }
      anchored.push(`${anchor} ${v}`.slice(0, 200));
    }
    return [...new Set(anchored)].slice(0, 8);
  }
  return out.slice(0, 8);
}

function claimKeywords(claimText) {
  const stop = new Set([
    "the", "and", "that", "with", "from", "this", "were", "have", "has", "into", "about", "china", "chinese",
    "open", "source", "data", "technology", "local", "governments", "government", "applications", "industry",
  ]);
  const words = String(claimText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 4 && !stop.has(w));
  const entities = String(claimText || "").match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) || [];
  return [...new Set([...entities.map((e) => e.toLowerCase()), ...words])].slice(0, 8);
}

function evidenceLooksRelevantToClaim(evidenceItem, claimText) {
  const keys = claimKeywords(claimText);
  if (!keys.length) return true;
  const hay = `${evidenceItem.title || ""} ${evidenceItem.desc || ""}`.toLowerCase();
  let hits = 0;
  for (const k of keys) {
    if (hay.includes(k)) hits += 1;
    if (hits >= 2) return true;
  }
  return hits >= 1 && keys.some((k) => k.length >= 8);
}

function stripXmlTags(input) {
  return String(input || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * No-key fallback when NewsData is unavailable (Google News RSS).
 */
async function fetchGoogleNewsRssForQuery(q, forClaim) {
  const query = buildNewsDataQuery(q, forClaim);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  try {
    const res = await fetchWithTimeout(url.toString());
    const xml = await res.text();
    if (!res.ok || !xml) return [];

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out = [];
    for (const item of items.slice(0, 10)) {
      const title = stripXmlTags((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
      const linkRaw = stripXmlTags((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
      const desc = stripXmlTags((item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || "");
      const sourceName = stripXmlTags((item.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "");
      if (!title || !linkRaw) continue;
      out.push({
        title,
        source: sourceName || hostFromLink(linkRaw) || "news.google.com",
        desc: desc.slice(0, 500),
        forClaim,
        link: linkRaw,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * NewsData.io — latest news with pagination until enough trusted-domain rows or pages exhausted.
 * @see https://newsdata.io/documentation
 */
async function fetchNewsDataForQuery(q, forClaim, options = {}) {
  const { trustedDomainsOnly = true, trustedDomains = parseTrustedDomains() } = options;
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  const query = buildNewsDataQuery(q, forClaim);
  if (!apiKey) {
    const rssEvidence = await fetchGoogleNewsRssForQuery(query, forClaim);
    return rssEvidence;
  }

  const poolTarget = Math.min(Number(process.env.NEWSDATA_EVIDENCE_POOL) || 24, 80);
  const maxPages = Number(process.env.NEWSDATA_MAX_PAGES) || 2;
  /** Free NewsData plans allow size 1–10; paid allows higher (see NewsData docs). */
  const pageSize = Math.min(Math.max(Number(process.env.NEWSDATA_PAGE_SIZE) || 10, 1), 50);

  const collected = [];
  let nextPage = null;
  let pages = 0;

  async function fetchByDomainUrl(qText) {
    const domainParam = domainsForNewsDataDomainurl(trustedDomains).join(",");
    if (!domainParam) return [];
    const url = new URL("https://newsdata.io/api/1/latest");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("q", qText);
    url.searchParams.set("domainurl", domainParam);
    if (process.env.NEWSDATA_LANGUAGE) {
      url.searchParams.set("language", process.env.NEWSDATA_LANGUAGE);
    } else {
      url.searchParams.set("language", "en");
    }
    url.searchParams.set("size", String(Math.min(pageSize, 10)));
    const res = await fetchWithTimeout(url.toString());
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== "success") {
      const msg = data?.results?.message || data?.message;
      if (msg) console.warn("[newsSearch] domainurl NewsData request:", msg);
      return [];
    }
    const pageResults = Array.isArray(data.results) ? data.results : [];
    return pageResults.map((art) => mapArticleToEvidence(art, forClaim));
  }

  while (pages < maxPages) {
    pages += 1;
    const url = new URL("https://newsdata.io/api/1/latest");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("q", query);
    if (process.env.NEWSDATA_LANGUAGE) {
      url.searchParams.set("language", process.env.NEWSDATA_LANGUAGE);
    } else {
      url.searchParams.set("language", "en");
    }
    if (pageSize) {
      url.searchParams.set("size", String(pageSize));
    }
    if (nextPage) {
      url.searchParams.set("page", nextPage);
    }

    const res = await fetchWithTimeout(url.toString());
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== "success") {
      if (apiKey && data && typeof data === "object") {
        const msg = data.results?.message || data.message || data.status || res.status;
        console.warn("[newsSearch] NewsData.io response not usable:", msg);
      }
      break;
    }

    const pageResults = Array.isArray(data.results) ? data.results : [];
    for (const art of pageResults) {
      collected.push(mapArticleToEvidence(art, forClaim));
    }

    const filtered = trustedDomainsOnly ? filterTrustedEvidence(collected, trustedDomains) : collected;
    if (filtered.length >= poolTarget) {
      return filtered.slice(0, poolTarget);
    }

    nextPage = data.nextPage || null;
    if (!nextPage) break;
  }

  /** Full query often returns totalResults 0; try shorter keyword phrases (one page each). */
  if (collected.length === 0) {
    const variants = broadenQueryVariants(query);
    for (const qAlt of variants) {
      if (qAlt === query) continue;
      const url = new URL("https://newsdata.io/api/1/latest");
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("q", qAlt);
      if (process.env.NEWSDATA_LANGUAGE) {
        url.searchParams.set("language", process.env.NEWSDATA_LANGUAGE);
      } else {
        url.searchParams.set("language", "en");
      }
      url.searchParams.set("size", String(Math.min(pageSize, 10)));
      const res = await fetchWithTimeout(url.toString());
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.status !== "success") continue;
      const pageResults = Array.isArray(data.results) ? data.results : [];
      for (const art of pageResults) {
        collected.push(mapArticleToEvidence(art, forClaim));
      }
      if (collected.length > 0) {
        console.warn("[newsSearch] Broadened query returned results:", qAlt);
        break;
      }
    }
  }

  /** Keyword search can miss outlet-specific stories; try trusted domains directly (helps CNA/BBC hits). */
  if (collected.length === 0) {
    let fromDomains = await fetchByDomainUrl(query);
    if (fromDomains.length === 0 && query !== "news") {
      fromDomains = await fetchByDomainUrl("news");
    }
    collected.push(...fromDomains);
  }

  let final = trustedDomainsOnly ? filterTrustedEvidence(collected, trustedDomains) : collected;
  if (final.length > 0) {
    return final.slice(0, poolTarget);
  }

  /**
   * NewsData returned articles, but none matched EVIDENCE_DOMAINS.
   * Optionally use other NewsData rows; else try RSS; never return fabricated evidence.
   */
  const allowUnfiltered =
    process.env.EVIDENCE_ALLOW_UNFILTERED_FALLBACK !== "false";
  if (trustedDomainsOnly && allowUnfiltered && collected.length > 0) {
    console.warn(
      "[newsSearch] No articles from trusted domains for this query; using other NewsData.io results. " +
        "Narrow topics: add outlets to EVIDENCE_DOMAINS or set EVIDENCE_ALLOW_UNFILTERED_FALLBACK=false for stricter filtering.",
    );
    return collected.slice(0, Math.min(poolTarget, collected.length));
  }

  const rssLast = await fetchGoogleNewsRssForQuery(query, forClaim);
  if (rssLast.length) return rssLast.slice(0, poolTarget);
  return [];
}

/**
 * @param {Array<{ claim?: string, q?: string }>} claims
 * @param {{ trustedDomainsOnly?: boolean }} [options]
 */
async function searchForClaims(claims, options = {}) {
  const trustedDomainsOnly = options.trustedDomainsOnly !== false;
  const trustedDomains = options.trustedDomains || parseTrustedDomains();
  const perClaimMax = Math.max(2, Number(process.env.NEWSDATA_PER_CLAIM_MAX || 4));
  const maxClaims = Math.max(1, Number(process.env.NEWSDATA_MAX_CLAIMS || 4));
  const maxVariants = Math.max(1, Number(process.env.NEWSDATA_QUERY_VARIANTS || 4));
  const list = Array.isArray(claims) ? claims : [];
  const seenGlobal = new Set();

  async function evidenceForClaim(c) {
    const claimText = c.claim ?? String(c);
    const queries = claimQueryVariants(claimText, c.q || claimText).slice(0, maxVariants);
    const claimRows = [];
    const seenClaim = new Set();

    for (let i = 0; i < queries.length && claimRows.length < perClaimMax; i += 2) {
      const batchQueries = queries.slice(i, i + 2);
      const fetched = await Promise.all(
        batchQueries.map((q) =>
          fetchNewsDataForQuery(q, claimText, {
            trustedDomainsOnly,
            trustedDomains,
          }).catch(() => [])
        )
      );
      for (const batch of fetched) {
        for (const e of batch) {
          if (!evidenceLooksRelevantToClaim(e, claimText)) continue;
          const key = `${e.title}|${e.source}|${String(e.desc || "").slice(0, 80)}`;
          if (seenClaim.has(key) || seenGlobal.has(key)) continue;
          seenClaim.add(key);
          seenGlobal.add(key);
          claimRows.push(e);
          if (claimRows.length >= perClaimMax) break;
        }
        if (claimRows.length >= perClaimMax) break;
      }
    }
    return claimRows;
  }

  const rows = await Promise.all(list.slice(0, maxClaims).map((c) => evidenceForClaim(c)));
  return rows.flat();
}

module.exports = {
  searchForClaims,
  fetchNewsDataForQuery,
  parseTrustedDomains,
  domainsForNewsDataDomainurl,
  filterTrustedEvidence,
  hostMatchesTrusted,
};
