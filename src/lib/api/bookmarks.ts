import { supabase } from "../supabase";
import type { ArticleRow } from "../types/database";

/** Get bookmarked article ids for a user. */
export async function getBookmarkIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("article_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.article_id);
}

/** Get full bookmarked articles for user (e.g. BookmarksPage). */
export async function getBookmarkedArticles(userId: string): Promise<ArticleRow[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("article_id, articles(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { article_id: string; articles: ArticleRow | null }[];
  return rows.map((r) => r.articles).filter(Boolean) as ArticleRow[];
}

/** Add bookmark. */
export async function addBookmark(userId: string, articleId: string) {
  const { error } = await supabase.from("bookmarks").insert({ user_id: userId, article_id: articleId });
  if (error) throw error;
}

/** Remove bookmark. */
export async function removeBookmark(userId: string, articleId: string) {
  const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("article_id", articleId);
  if (error) throw error;
}

/** Check if article is bookmarked by user. */
export async function isBookmarked(userId: string, articleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("article_id")
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
