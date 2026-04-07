import { apiUrl } from "./apiBase";

/** POST /api/articles/summary — generated summary (not stored user excerpt). */
export type ArticleSummaryResult = {
  summary: string;
  source: "openai" | "huggingface" | "extract";
  /** True when returned from DB without calling the LLM (same article text as when stored). */
  cached?: boolean;
  /** False if the server could not write to Supabase (missing service role key, etc.). */
  persisted?: boolean;
  /** Shown when summary was generated but not saved to the article row. */
  persistHint?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in (data as object)
        ? String((data as { error: unknown }).error)
        : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/**
 * When `articleId` is set, the API loads title/body from Supabase and persists the summary on first request (shared for all readers).
 * Send `title` + `content` for legacy calls without `articleId`, or as fallback if the server has no service role.
 */
export async function fetchArticleSummary(params: {
  articleId?: string;
  title?: string;
  content?: string;
}) {
  const { articleId, title, content } = params;
  if (!articleId && (content == null || !String(content).trim())) {
    throw new Error("content is required when articleId is omitted");
  }
  return postJson<ArticleSummaryResult>(apiUrl("/api/articles/summary"), {
    ...(articleId ? { articleId } : {}),
    ...(title != null ? { title } : {}),
    ...(content != null ? { content } : {}),
  });
}
