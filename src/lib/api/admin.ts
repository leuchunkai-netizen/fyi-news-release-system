/**
 * Admin-only API: list users, articles, comments, expert applications.
 * Requires RLS policies that allow role = 'admin' to read these tables (see migration admin_rls.sql).
 */
import { supabase } from "../supabase";
import type { UserRow, UserRole, CategoryRow, ReportStatus } from "../types/database";

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
  /** Pending `comment_reports` rows for this comment (admin review queue). */
  pendingReportIds?: string[];
  /** Combined reporter reasons (truncated for display). */
  pendingReportSummary?: string | null;
}

export interface AdminExpertApplication {
  id: string;
  name: string;
  email: string;
  expertise: string;
  credentials: string;
  /** Public URL of uploaded proof (image/PDF), if provided. */
  proofDocumentUrl: string | null;
  status: string;
  appliedDate: string;
  user_id: string;
}

export interface AdminReport {
  id: string;
  article_id: string;
  user_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
  article_title: string;
  reporter_email: string;
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

/** Mark user-submitted comment reports as reviewed (admin only). */
export async function markCommentReportsReviewed(reportIds: string[]): Promise<void> {
  if (reportIds.length === 0) return;
  const { error } = await supabase.from("comment_reports").update({ status: "reviewed" }).in("id", reportIds);
  if (error) throw error;
}

type AdminCommentRow = {
  id: string;
  content: string;
  status: string;
  article_id: string;
  user_id: string;
  created_at: string;
  pendingReportIds?: string[];
  pendingReportSummary?: string | null;
};

/** Flagged comments plus comments with pending user reports (`comment_reports`). */
export async function getAdminComments(): Promise<AdminComment[]> {
  const [reportsRes, flaggedRes] = await Promise.all([
    supabase
      .from("comment_reports")
      .select("id, comment_id, user_id, reason, created_at")
      .eq("status", "pending"),
    supabase
      .from("comments")
      .select("id, content, status, article_id, user_id, created_at")
      .eq("status", "flagged")
      .order("created_at", { ascending: false }),
  ]);
  if (reportsRes.error) throw reportsRes.error;
  if (flaggedRes.error) throw flaggedRes.error;

  const reportRows = (reportsRes.data ?? []) as {
    id: string;
    comment_id: string;
    user_id: string;
    reason: string | null;
    created_at: string;
  }[];

  const byCommentReports = new Map<string, { ids: string[]; summaries: string[]; lastAt: string }>();
  for (const r of reportRows) {
    const cur = byCommentReports.get(r.comment_id) ?? { ids: [], summaries: [], lastAt: r.created_at };
    cur.ids.push(r.id);
    if (r.reason?.trim()) cur.summaries.push(r.reason.trim());
    if (new Date(r.created_at) > new Date(cur.lastAt)) cur.lastAt = r.created_at;
    byCommentReports.set(r.comment_id, cur);
  }

  const flaggedRows = (flaggedRes.data ?? []) as {
    id: string;
    content: string;
    status: string;
    article_id: string;
    user_id: string;
    created_at: string;
  }[];

  const flaggedById = new Map(flaggedRows.map((c) => [c.id, c]));
  const extraIds = [...byCommentReports.keys()].filter((id) => !flaggedById.has(id));

  let extraRows: typeof flaggedRows = [];
  if (extraIds.length > 0) {
    const { data: extraData, error: extraErr } = await supabase
      .from("comments")
      .select("id, content, status, article_id, user_id, created_at")
      .in("id", extraIds);
    if (extraErr) throw extraErr;
    extraRows = (extraData ?? []) as typeof flaggedRows;
  }

  const combined: typeof flaggedRows = [...flaggedRows];
  for (const row of extraRows) {
    if (!flaggedById.has(row.id)) combined.push(row);
  }

  const withMeta: AdminCommentRow[] = combined.map((row) => {
    const rep = byCommentReports.get(row.id);
    const pendingReportIds = rep?.ids ?? [];
    const pendingReportSummary =
      rep && rep.summaries.length > 0
        ? rep.summaries.slice(0, 3).join(" · ") + (rep.summaries.length > 3 ? " …" : "")
        : null;
    return {
      ...row,
      ...(pendingReportIds.length > 0 ? { pendingReportIds, pendingReportSummary } : {}),
    };
  });

  withMeta.sort((a, b) => {
    const repA = byCommentReports.get(a.id);
    const repB = byCommentReports.get(b.id);
    const tA = Math.max(new Date(a.created_at).getTime(), repA ? new Date(repA.lastAt).getTime() : 0);
    const tB = Math.max(new Date(b.created_at).getTime(), repB ? new Date(repB.lastAt).getTime() : 0);
    return tB - tA;
  });

  if (withMeta.length === 0) return [];

  try {
    const articleIds = Array.from(new Set(withMeta.map((r) => r.article_id)));
    const userIds = Array.from(new Set(withMeta.map((r) => r.user_id)));

    const [articlesRes, usersRes] = await Promise.all([
      supabase.from("articles").select("id, title").in("id", articleIds),
      supabase.from("users").select("id, name").in("id", userIds),
    ]);

    const articleMap = new Map<string, string>(
      (articlesRes.data ?? []).map((a: any) => [a.id as string, (a.title as string) ?? ""])
    );
    const userMap = new Map<string, string>(
      (usersRes.data ?? []).map((u: any) => [u.id as string, (u.name as string) ?? ""])
    );

    return withMeta.map((r) => ({
      id: r.id,
      author: userMap.get(r.user_id) ?? "Unknown",
      article: articleMap.get(r.article_id) ?? "Unknown",
      content: r.content,
      status: r.status,
      article_id: r.article_id,
      user_id: r.user_id,
      ...(r.pendingReportIds?.length
        ? { pendingReportIds: r.pendingReportIds, pendingReportSummary: r.pendingReportSummary ?? null }
        : {}),
    }));
  } catch {
    return withMeta.map((r) => ({
      id: r.id,
      author: "Unknown",
      article: "Unknown",
      content: r.content,
      status: r.status,
      article_id: r.article_id,
      user_id: r.user_id,
      ...(r.pendingReportIds?.length
        ? { pendingReportIds: r.pendingReportIds, pendingReportSummary: r.pendingReportSummary ?? null }
        : {}),
    }));
  }
}

/** List expert applications with user name/email (admin only). */
export async function getAdminExpertApplications(): Promise<AdminExpertApplication[]> {
  const { data: apps, error: appsError } = await supabase
    .from("expert_applications")
    .select("id, user_id, expertise, credentials, proof_document_url, status, applied_at")
    .order("applied_at", { ascending: false });
  if (appsError) throw appsError;
  const list =
    (apps as
      | {
          id: string;
          user_id: string;
          expertise: string;
          credentials: string;
          proof_document_url: string | null;
          status: string;
          applied_at: string | null;
        }[]
      | null) ?? [];
  if (list.length === 0) return [];

  // Best-effort join to users for name/email; if it fails, still return applications.
  try {
    const userIds = [...new Set(list.map((a) => a.user_id))];
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds);
    const userMap = new Map(
      (users ?? []).map((u: any) => [u.id as string, { name: u.name as string, email: (u.email as string) ?? "" }])
    );

    return list.map((a) => ({
      id: a.id,
      name: userMap.get(a.user_id)?.name ?? "Unknown",
      email: userMap.get(a.user_id)?.email ?? "",
      expertise: a.expertise,
      credentials: a.credentials,
      proofDocumentUrl: a.proof_document_url ?? null,
      status: a.status,
      appliedDate: a.applied_at
        ? new Date(a.applied_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "",
      user_id: a.user_id,
    }));
  } catch {
    return list.map((a) => ({
      id: a.id,
      name: "Unknown",
      email: "",
      expertise: a.expertise,
      credentials: a.credentials,
      proofDocumentUrl: a.proof_document_url ?? null,
      status: a.status,
      appliedDate: a.applied_at
        ? new Date(a.applied_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "",
      user_id: a.user_id,
    }));
  }
}

/** Update user status (admin only). */
export async function updateUserStatus(userId: string, status: "active" | "suspended") {
  const { error } = await supabase.from("users").update({ status }).eq("id", userId);
  if (error) throw error;
}

/** Update user role (admin only). */
export async function updateUserRole(userId: string, role: UserRole) {
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw error;
}

/** Update article status (admin only). Uses a DB function to bypass RLS. */
export async function updateArticleStatus(articleId: string, status: "published" | "rejected" | "flagged") {
  const { error } = await supabase.rpc("update_article_status_admin", {
    p_article_id: articleId,
    p_status: status,
  });
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
  const { error } = await supabase.rpc("admin_set_expert_application_status", {
    p_application_id: applicationId,
    p_status: status,
    p_reviewed_by: reviewedByUserId ?? null,
  });
  if (error) throw error;
}

/** Create category (admin only). */
export async function createCategory(name: string, slug: string, description?: string | null) {
  const { error } = await supabase.from("categories").insert({ name, slug, description: description ?? null });
  if (error) throw error;
}

/** Update category details (admin only). */
export async function updateCategory(categoryId: string, updates: Partial<Pick<CategoryRow, "name" | "slug" | "description">>) {
  const { error } = await supabase.from("categories").update(updates).eq("id", categoryId);
  if (error) throw error;
}

/** Delete category (admin only). */
export async function deleteCategory(categoryId: string) {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw error;
}

/** Reassign all articles from one category to another (admin only). */
export async function reassignCategoryArticles(oldCategoryId: string, newCategoryId: string) {
  const { error } = await supabase
    .from("articles")
    .update({ category_id: newCategoryId })
    .eq("category_id", oldCategoryId);
  if (error) throw error;
}

/** Get pending article reports for "Review Flagged Content" flow (admin only). */
export async function getAdminArticleReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from("article_reports")
    .select("id, article_id, user_id, reason, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    article_id: string;
    user_id: string;
    reason: string | null;
    status: ReportStatus;
    created_at: string;
  }[];

  if (rows.length === 0) return [];

  try {
    const articleIds = Array.from(new Set(rows.map((r) => r.article_id)));
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    const [articlesRes, usersRes] = await Promise.all([
      supabase.from("articles").select("id, title").in("id", articleIds),
      supabase.from("users").select("id, email").in("id", userIds),
    ]);

    const articleMap = new Map<string, string>(
      (articlesRes.data ?? []).map((a: any) => [a.id as string, (a.title as string) ?? ""])
    );
    const userEmailMap = new Map<string, string>(
      (usersRes.data ?? []).map((u: any) => [u.id as string, (u.email as string) ?? ""])
    );

    return rows.map((r) => ({
      id: r.id,
      article_id: r.article_id,
      user_id: r.user_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      article_title: articleMap.get(r.article_id) ?? "Unknown",
      reporter_email: userEmailMap.get(r.user_id) ?? "",
    }));
  } catch {
    // Fallback: still show report rows even if enrichment fails.
    return rows.map((r) => ({
      id: r.id,
      article_id: r.article_id,
      user_id: r.user_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      article_title: "Unknown",
      reporter_email: "",
    }));
  }
}

/** Mark a report as reviewed / resolved (admin only). */
export async function updateArticleReportStatus(reportId: string, status: ReportStatus = "reviewed") {
  const { error } = await supabase.rpc("update_article_report_status_admin", {
    p_report_id: reportId,
    p_status: status,
  });

  if (!error) return;

  // Backward compatibility: if the RPC does not exist yet, try direct table update.
  // This still depends on RLS policies being present.
  if ((error as { code?: string }).code === "42883") {
    const { error: fallbackError } = await supabase
      .from("article_reports")
      .update({ status })
      .eq("id", reportId);
    if (fallbackError) throw fallbackError;
    return;
  }

  throw error;
}
