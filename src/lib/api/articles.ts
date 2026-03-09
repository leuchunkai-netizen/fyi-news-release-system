import { supabase } from "../supabase";
import type { ArticleRow, ArticleStatus } from "../types/database";

export interface ArticleWithCategory extends ArticleRow {
  category?: { name: string; slug: string } | null;
}

/** Fetch published articles (home, search). Optional: filter by category slug, text search, limit, offset. */
export async function getPublishedArticles(options?: {
  categorySlug?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("articles")
    .select("*, category:categories(name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.categorySlug && options.categorySlug !== "all") {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", options.categorySlug).maybeSingle();
    if (cat) query = query.eq("category_id", cat.id);
  }

  if (options?.q?.trim()) {
    const raw = options.q.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const term = `"%${raw}%"`;
    query = query.or(`title.ilike.${term},excerpt.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ArticleWithCategory[];
}

/** Fetch a single published article by id (for detail page). */
export async function getArticleById(id: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(id, name, slug)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ArticleWithCategory | null;
}

/** Increment article view count (call when viewing detail page). */
export async function incrementArticleViews(id: string) {
  const { data: row } = await supabase.from("articles").select("views").eq("id", id).single();
  if (!row) return;
  const { error } = await supabase
    .from("articles")
    .update({ views: (row.views ?? 0) + 1 })
    .eq("id", id);
  if (error) throw error;
}

/** Articles by current user (my articles). */
export async function getMyArticles(authorId: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug)")
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArticleWithCategory[];
}

/** Create article (submit). */
export async function createArticle(insert: {
  author_id: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  image_url?: string | null;
  author_display_name?: string | null;
  author_bio?: string | null;
  category_id?: string | null;
  status?: ArticleStatus;
}) {
  const { data, error } = await supabase
    .from("articles")
    .insert({
      ...insert,
      status: insert.status ?? "draft",
      submitted_at: insert.status === "pending" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ArticleRow;
}

/** Update article (author only). */
export async function updateArticle(
  id: string,
  updates: Partial<Pick<ArticleRow, "title" | "excerpt" | "content" | "image_url" | "author_display_name" | "author_bio" | "category_id" | "status">>
) {
  const { data, error } = await supabase.from("articles").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ArticleRow;
}

/** Delete article (author only; RLS enforces author_id = auth.uid()). */
export async function deleteArticle(id: string) {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}

/** Fetch credibility analysis for an article (if present). */
export async function getCredibilityAnalysis(articleId: string) {
  const { data, error } = await supabase
    .from("article_credibility_analysis")
    .select("*")
    .eq("article_id", articleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Report an article (authenticated user). */
export async function reportArticle(articleId: string, userId: string, reason?: string | null) {
  const { error } = await supabase.from("article_reports").insert({
    article_id: articleId,
    user_id: userId,
    reason: reason ?? null,
    status: "pending",
  });
  if (error) throw error;
}

/** Pending articles for expert review (status = pending). */
export async function getExpertPendingArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, excerpt, author_display_name, created_at, submitted_at, image_url, category:categories(name)")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    title: string;
    excerpt: string | null;
    author_display_name: string | null;
    created_at: string;
    submitted_at: string | null;
    image_url: string | null;
    category: { name: string } | null;
  }[];
}

/** Submit expert review: insert expert_reviews and update article status. */
export async function submitExpertReview(
  articleId: string,
  expertId: string,
  params: {
    decision: "approved" | "rejected";
    credibilityScore: number;
    factualAccuracy?: number | null;
    rating?: number | null;
    comments?: string | null;
    flagged?: boolean;
  }
) {
  const { error: reviewErr } = await supabase.from("expert_reviews").insert({
    article_id: articleId,
    expert_id: expertId,
    credibility_score: params.credibilityScore,
    factual_accuracy: params.factualAccuracy ?? null,
    rating: params.rating ?? null,
    comments: params.comments ?? null,
    flagged: params.flagged ?? false,
    decision: params.decision,
  });
  if (reviewErr) throw reviewErr;
  const updates =
    params.decision === "approved"
      ? {
          status: "published" as const,
          credibility_score: params.credibilityScore,
          is_verified: true,
          expert_reviewer_id: expertId,
          published_at: new Date().toISOString(),
          rejection_reason: null,
        }
      : {
          status: "rejected" as const,
          rejection_reason: params.comments ?? "Rejected by expert",
        };
  const { error: articleErr } = await supabase.from("articles").update(updates).eq("id", articleId);
  if (articleErr) throw articleErr;
}

/** Featured articles (optional). */
export async function getFeaturedArticles(limit = 5) {
  const { data, error } = await supabase
    .from("featured_articles")
    .select("article_id, sort_order, articles(*)")
    .order("sort_order", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
