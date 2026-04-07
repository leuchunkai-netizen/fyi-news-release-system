const filters = require("../utils/filters");

/** Default: BBC, CNA, Reuters (hostname suffixes / exact hosts). */
const DEFAULT_EVIDENCE_DOMAINS = ["bbc.co.uk", "bbc.com", "channelnewsasia.com", "reuters.com"];

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

function mockEvidence(forClaim) {
  return [
    {
      title: "Mock evidence source #1",
      source: "example.com",
      desc:
        "Placeholder — no NEWSDATA_API_KEY, or NewsData returned no rows (empty query, API error, or no matches in the last 48 hours). Check server logs for [newsSearch].",
      forClaim,
    },
    {
      title: "Mock evidence source #2",
      source: "example.org",
      desc: "Second placeholder evidence item.",
      forClaim,
    },
  ];
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
    return mockEvidence(forClaim);
  }

  const poolTarget = Math.min(Number(process.env.NEWSDATA_EVIDENCE_POOL) || 24, 80);
  const maxPages = Number(process.env.NEWSDATA_MAX_PAGES) || 4;
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
    const res = await fetch(url.toString());
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

    const res = await fetch(url.toString());
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
      const res = await fetch(url.toString());
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
   * NewsData returned articles, but none matched EVIDENCE_DOMAINS (e.g. K-pop stories rarely
   * appear on BBC/Reuters). Prefer real NewsData rows over mock placeholders unless explicitly strict.
   */
  const allowUnfiltered =
    process.env.EVIDENCE_ALLOW_UNFILTERED_FALLBACK !== "false";
  if (trustedDomainsOnly && allowUnfiltered && collected.length > 0) {
    console.warn(
      "[newsSearch] No articles from trusted domains for this query; using other NewsData.io results. " +
        "Narrow topics: add outlets to EVIDENCE_DOMAINS or set EVIDENCE_ALLOW_UNFILTERED_FALLBACK=false to use placeholders only.",
    );
    return collected.slice(0, Math.min(poolTarget, collected.length));
  }

  return mockEvidence(forClaim);
}

/**
 * @param {Array<{ claim?: string, q?: string }>} claims
 * @param {{ trustedDomainsOnly?: boolean }} [options]
 */
async function searchForClaims(claims, options = {}) {
  const trustedDomainsOnly = options.trustedDomainsOnly !== false;
  const trustedDomains = options.trustedDomains || parseTrustedDomains();
  const list = Array.isArray(claims) ? claims : [];
  const evidence = [];
  const seen = new Set();
  for (const c of list.slice(0, 5)) {
    const claimText = c.claim ?? String(c);
    const q = c.q || claimText;
    const batch = await fetchNewsDataForQuery(q, claimText, {
      trustedDomainsOnly,
      trustedDomains,
    });
    for (const e of batch) {
      const key = `${e.title}|${e.source}|${e.forClaim}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push(e);
    }
  }
  return evidence;
}

module.exports = {
  searchForClaims,
  fetchNewsDataForQuery,
  mockEvidence,
  parseTrustedDomains,
  domainsForNewsDataDomainurl,
  filterTrustedEvidence,
  hostMatchesTrusted,
};
