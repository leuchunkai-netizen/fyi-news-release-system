import { supabase } from "../supabase";
import { apiUrl } from "./apiBase";

/** Replay of last POST /api/articles/factcheck — enables fast submit when title/body unchanged. */
export type FactcheckSnapshotForSubmit = {
  claims: Array<{ claim?: string; q?: string }>;
  top3: Array<{ title?: string; source?: string; desc?: string; forClaim?: string }>;
  fc: {
    claims: Array<{ claim: string; verdict: string; why?: string }>;
    confidence: number;
    verdict: string;
    summary: string;
    evidenceUsed?: Array<{ title?: string; source?: string; desc?: string; forClaim?: string }>;
  };
};

export type SubmitReviewResult = {
  autoApproved: boolean;
  verdict: string;
  confidence: number;
  baseVerdict?: string;
  /** Base used for scoring (editor pipeline when sent, else server re-run). */
  baseConfidence?: number;
  /** Second server-only pipeline run (can differ from the editor). */
  serverBaseConfidence?: number;
  usedClientPipelineConfidence?: boolean;
  /** Server skipped claim/news/LLM pipeline and used `factcheckSnapshot` (same text as saved article). */
  skippedServerPipeline?: boolean;
  minConfidence: number;
  allowedVerdicts: string[];
  credibilitySaved?: boolean;
  credibilitySaveError?: string | null;
  sourceEvidenceSummary?: {
    totalChecks: number;
    ignoredChecks?: number;
    supportHigh: number;
    supportLow: number;
    contradicts: number;
  };
};

async function postJson<T>(url: string, body: unknown, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    let msg =
      data && typeof data === "object" && "error" in (data as object)
        ? String((data as { error: unknown }).error)
        : `Request failed: ${res.status}`;
    if (res.status === 404) {
      msg +=
        " — Start the API (e.g. npm run dev, not vite alone) or set VITE_API_URL=http://localhost:10000 in .env.";
    }
    throw new Error(msg);
  }
  return data as T;
}

/**
 * Run fact-check + auto-publish rules on the server after saving the article as pending.
 * Requires the user session (Bearer token).
 */
export async function evaluateSubmitForReview(params: {
  articleId: string;
  title?: string;
  body: string;
  /** From last Run fact check in the editor so saved score matches the preview (optional). */
  pipelineConfidence?: number;
  /** When set with unchanged title/body vs DB, server skips a second pipeline run. */
  factcheckSnapshot?: FactcheckSnapshotForSubmit;
  userSourceChecks?: Array<{
    claim?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    aiVerdict: "SUPPORT" | "CONTRADICT" | "UNRELATED";
    sourceCredibility: "HIGH" | "LOW";
    confidence?: number;
    reason?: string;
  }>;
}): Promise<SubmitReviewResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in to submit for review.");

  return postJson<SubmitReviewResult>(apiUrl("/api/articles/submit-review"), params, token);
}
