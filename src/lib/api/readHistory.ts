import { supabase } from "../supabase";
import type { ArticleWithCategory } from "./articles";

/** Record or refresh last-open time (direct upsert; prefer RPC in production). */
export async function recordArticleRead(userId: string, articleId: string) {
  const viewed_at = new Date().toISOString();
  const { error } = await supabase.from("article_read_history").upsert(
    { user_id: userId, article_id: articleId, viewed_at },
    { onConflict: "user_id,article_id" }
  );
  if (error) throw error;
}

/**
 * Records a read using DB RPC `record_article_read` (auth.uid() + role check inside Postgres).
 * Uses getSession() first so it works as soon as the JWT is in memory.
 */
export async function tryRecordPremiumArticleRead(articleId: string, articleStatus: string) {
  if (articleStatus !== "published") return;
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session?.user) return;

  const { error: rpcErr } = await supabase.rpc("record_article_read", {
    p_article_id: articleId,
  });

  if (rpcErr) {
    const code = (rpcErr as { code?: string }).code;
    const msg = rpcErr.message ?? "";
    if (
      code === "PGRST202" ||
      msg.includes("Could not find the function") ||
      msg.includes("record_article_read")
    ) {
      console.warn(
        "[reading history] RPC missing — run migration 20260408140000_record_article_read_rpc.sql on Supabase, then reload."
      );
      return;
    }
    if (code === "42P01" || msg.includes("article_read_history")) {
      console.warn(
        "[reading history] Table missing — run migration 20260408120000_article_read_history.sql on Supabase."
      );
      return;
    }
    console.warn("[reading history] record_article_read:", rpcErr);
  }
}

export interface ReadHistoryItem {
  viewed_at: string;
  article: ArticleWithCategory;
}

/** List articles the current session has opened, most recent first (uses JWT user id). */
export async function getReadingHistory(): Promise<ReadHistoryItem[]> {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session?.user) return [];
  const userId = session.user.id;

  const { data: historyRows, error: hErr } = await supabase
    .from("article_read_history")
    .select("viewed_at, article_id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(200);
  if (hErr) throw hErr;
  const rows = (historyRows ?? []) as { viewed_at: string; article_id: string }[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.article_id))];
  const { data: articlesData, error: aErr } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug)")
    .in("id", ids)
    .eq("status", "published");
  if (aErr) throw aErr;
  const byId = new Map((articlesData ?? []).map((a) => [a.id, a as ArticleWithCategory]));

  return rows
    .map((r) => {
      const article = byId.get(r.article_id);
      if (!article) return null;
      return { viewed_at: r.viewed_at, article };
    })
    .filter((x): x is ReadHistoryItem => x !== null);
}

/** Remove one entry from history (e.g. user clears an item). */
export async function removeReadingHistoryEntry(userId: string, articleId: string) {
  const { error } = await supabase
    .from("article_read_history")
    .delete()
    .eq("user_id", userId)
    .eq("article_id", articleId);
  if (error) throw error;
}
