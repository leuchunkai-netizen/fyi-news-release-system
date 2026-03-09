/**
 * Admin-only API: list users, articles, comments, expert applications.
 * Requires RLS policies that allow role = 'admin' to read these tables (see migration admin_rls.sql).
 */
import { supabase } from "../supabase";
import type { UserRow } from "../types/database";

export interface AdminUser extends UserRow {
  joined?: string;
}

export interface AdminArticle {
  id: string;
  title: string;
  author: string;
  status: string;
  date: string;
  author_id: string | null;
  category_id: string | null;
}

export interface AdminComment {
  id: string;
  author: string;
  article: string;
  content: string;
  status: string;
  article_id: string;
  user_id: string;
}

export interface AdminExpertApplication {
  id: string;
  name: string;
  email: string;
  expertise: string;
  credentials: string;
  status: string;
  appliedDate: string;
  user_id: string;
}

/** List all users (admin only – requires RLS policy). */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    ...u,
    joined: u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
  })) as AdminUser[];
}

/** List all articles for moderation (admin only). */
export async function getAdminArticles(): Promise<AdminArticle[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, author_display_name, status, updated_at, author_id, category_id")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    author: a.author_display_name ?? "Unknown",
    status: a.status,
    date: a.updated_at ? new Date(a.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    author_id: a.author_id,
    category_id: a.category_id,
  }));
}

/** List all comments for moderation (admin only). */
export async function getAdminComments(): Promise<AdminComment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, content, status, article_id, user_id, articles(title), users(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return rows.map((r: { id: string; content: string; status: string; article_id: string; user_id: string; articles: { title?: string } | null; users: { name?: string } | null }) => ({
    id: r.id,
    author: (r.users as { name?: string } | null)?.name ?? "Unknown",
    article: (r.articles as { title?: string } | null)?.title ?? "Unknown",
    content: r.content,
    status: r.status,
    article_id: r.article_id,
    user_id: r.user_id,
  }));
}

/** List expert applications with user name/email (admin only). */
export async function getAdminExpertApplications(): Promise<AdminExpertApplication[]> {
  const { data: apps, error: appsError } = await supabase
    .from("expert_applications")
    .select("id, user_id, expertise, credentials, status, applied_at")
    .order("applied_at", { ascending: false });
  if (appsError) throw appsError;
  const list = apps ?? [];
  if (list.length === 0) return [];
  const userIds = [...new Set(list.map((a) => a.user_id))];
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", userIds);
  if (usersError) throw usersError;
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  return list.map((a) => ({
    id: a.id,
    name: userMap.get(a.user_id)?.name ?? "Unknown",
    email: userMap.get(a.user_id)?.email ?? "",
    expertise: a.expertise,
    credentials: a.credentials,
    status: a.status,
    appliedDate: a.applied_at ? new Date(a.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    user_id: a.user_id,
  }));
}

/** Update user status (admin only). */
export async function updateUserStatus(userId: string, status: "active" | "suspended") {
  const { error } = await supabase.from("users").update({ status }).eq("id", userId);
  if (error) throw error;
}

/** Update article status or delete (admin only). */
export async function updateArticleStatus(articleId: string, status: "published" | "rejected" | "flagged") {
  const { error } = await supabase.from("articles").update({ status }).eq("id", articleId);
  if (error) throw error;
}

export async function deleteArticle(articleId: string) {
  const { error } = await supabase.from("articles").delete().eq("id", articleId);
  if (error) throw error;
}

/** Update comment status or delete (admin only). */
export async function updateCommentStatus(commentId: string, status: "active" | "flagged") {
  const { error } = await supabase.from("comments").update({ status }).eq("id", commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

/** Approve or reject expert application (admin only). On approve, set user role to expert. */
export async function updateExpertApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected",
  reviewedByUserId?: string
) {
  const { data: app, error: fetchErr } = await supabase
    .from("expert_applications")
    .select("user_id")
    .eq("id", applicationId)
    .single();
  if (fetchErr || !app) throw fetchErr || new Error("Application not found");
  const { error: updateApp } = await supabase
    .from("expert_applications")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      ...(reviewedByUserId && { reviewed_by: reviewedByUserId }),
    })
    .eq("id", applicationId);
  if (updateApp) throw updateApp;
  if (status === "approved") {
    const { error: updateUser } = await supabase.from("users").update({ role: "expert" }).eq("id", app.user_id);
    if (updateUser) throw updateUser;
  }
}

/** Create category (admin only). */
export async function createCategory(name: string, slug: string, description?: string | null) {
  const { error } = await supabase.from("categories").insert({ name, slug, description: description ?? null });
  if (error) throw error;
}
