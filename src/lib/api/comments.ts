import { supabase } from "../supabase";
import type { CommentRow } from "../types/database";

export interface CommentWithAuthor extends CommentRow {
  user?: { name: string; avatar: string | null } | null;
}

/** Get comments for an article, enriching with user name/avatar when possible. Only active comments are returned; flagged comments are hidden. */
export async function getComments(articleId: string): Promise<CommentWithAuthor[]> {
  // 1) Load only active comments (flagged comments are hidden on the article page)
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("article_id", articleId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const comments = (data ?? []) as CommentWithAuthor[];

  // 2) Best-effort: attach basic user info. If RLS on users blocks this,
  // we simply return comments without user objects so the UI still works.
  try {
    const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
    if (!userIds.length) return comments;

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, avatar")
      .in("id", userIds);
    if (usersError || !users) return comments;

    const userMap = new Map<string, { id: string; name: string; avatar: string | null }>(
      users.map((u: any) => [u.id, { id: u.id, name: u.name, avatar: u.avatar }])
    );

    return comments.map((c) => ({
      ...c,
      user: userMap.get(c.user_id) ?? undefined,
    }));
  } catch {
    return comments;
  }
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

/** Delete own comment (RLS enforces ownership). */
export async function deleteComment(commentId: string) {
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Comment was not deleted. You may not have permission.");
  }
}
