import { supabase } from "../supabase";
import type { CommentRow } from "../types/database";

export interface CommentWithAuthor extends CommentRow {
  user?: { name: string; avatar: string | null } | null;
}

/** Get comments for an article. */
export async function getComments(articleId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, user:users(name, avatar)")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentWithAuthor[];
}

/** Add comment (authenticated). */
export async function addComment(articleId: string, userId: string, content: string): Promise<CommentRow> {
  const { data, error } = await supabase
    .from("comments")
    .insert({ article_id: articleId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data as CommentRow;
}
