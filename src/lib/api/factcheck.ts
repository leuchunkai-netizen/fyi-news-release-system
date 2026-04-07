import { apiUrl } from "./apiBase";

type Claim = { claim: string; q?: string };
type EvidenceItem = { title: string; source: string; desc?: string; forClaim?: string };

/** Response from POST /api/articles/factcheck */
export type FactcheckResult = {
  claims?: { claim: string; verdict: "SUPPORTED" | "DISPUTED" | "UNVERIFIED"; why: string }[];
  confidence: number;
  verdict: "VERIFIED" | "UNCERTAIN" | "REJECTED";
  summary: string;
  top3?: EvidenceItem[];
  claimsList?: Claim[];
  /** True when `articleId` was sent and Supabase upsert succeeded */
  credibilitySaved?: boolean;
  /** Error message when save was attempted but failed */
  credibilitySaveError?: string | null;
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

/** Run the server fact-check pipeline (claims → NewsData.io → optional pgvector/rerank → LLM). Pass `articleId` when editing to persist analysis to `article_credibility_analysis`. */
export async function factcheckArticle(params: { title?: string; body: string; articleId?: string }) {
  return postJson<FactcheckResult>(apiUrl("/api/articles/factcheck"), params);
}
