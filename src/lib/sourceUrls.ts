/** Max URLs per expert source field (one API call each on Check). */
export const MAX_EXPERT_SOURCE_URLS = 12;

/** Shorten a URL for inline error messages (full string if it fits). */
export function formatUrlForDisplay(url: string, maxLen = 100): string {
  const u = url.trim();
  if (u.length <= maxLen) return u;
  return `${u.slice(0, maxLen - 1)}…`;
}

/**
 * From multiple input boxes: trim each, skip invalid, preserve order, dedupe case-insensitively.
 * Each string must be a full URL with http(s) scheme.
 */
export function parseSourceUrlInputs(inputs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of inputs) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    try {
      const u = new URL(line);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      seen.add(key);
      out.push(line);
      if (out.length >= MAX_EXPERT_SOURCE_URLS) break;
    } catch {
      continue;
    }
  }
  return out;
}

/** Stable key for “did the URL list change?” comparisons (multiple boxes). */
export function sourceUrlInputsFingerprint(inputs: string[]): string {
  return JSON.stringify(parseSourceUrlInputs(inputs));
}

/**
 * @deprecated Prefer {@link parseSourceUrlInputs} with one field per URL.
 * One URL per non-empty line (legacy single textarea).
 */
export function parseSourceUrlsMultiline(raw: string): string[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  return parseSourceUrlInputs(lines);
}

/** @deprecated Use {@link sourceUrlInputsFingerprint} with an array of box values. */
export function sourceUrlsFingerprint(raw: string): string {
  return JSON.stringify(parseSourceUrlsMultiline(raw));
}
