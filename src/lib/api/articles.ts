import { supabase } from "../supabase";
import type { ArticleRow, ArticleStatus, ExpertReviewRow } from "../types/database";
import { apiUrl } from "./apiBase";

export interface ArticleWithCategory extends ArticleRow {
  category?: { name: string; slug: string } | null;
  commentsCount?: number;
  /** True when a row exists in `article_credibility_analysis` (saved AI / fact-check). */
  hasCredibilityAnalysis?: boolean;
}

export interface TrendingArticleItem {
  id: string;
  title: string;
  category: string;
  views: number;
  comments: number;
  publishedAt: string | null;
}

export type SuggestedTagsResult = {
  tags: string[];
  source: "openai" | "huggingface" | "extract";
};

/** Normalize tags from DB array or comma-separated string (upload form). */
export function normalizeArticleTags(input: string | string[] | null | undefined): string[] {
  if (Array.isArray(input)) {
    return [...new Set(input.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  }
  if (typeof input === "string" && input.trim()) {
    return normalizeArticleTags(input.split(","));
  }
  return [];
}

export async function suggestArticleTags(params: {
  title?: string;
  content: string;
}): Promise<SuggestedTagsResult> {
  const res = await fetch(apiUrl("/api/articles/tags"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in (data as object)
        ? String((data as { error: unknown }).error)
        : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  const tags = normalizeArticleTags((data as { tags?: unknown })?.tags as string[] | undefined);
  const sourceRaw = String((data as { source?: unknown })?.source || "extract").toLowerCase();
  const source: SuggestedTagsResult["source"] =
    sourceRaw === "openai" || sourceRaw === "huggingface" || sourceRaw === "extract"
      ? sourceRaw
      : "extract";
  return { tags, source };
}

function tagOverlapCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

/** 2-column grid: only 0, 2, 4, or 6 items so rows stay balanced (no orphan). */
function takeEvenAlsoReadCount<T>(items: T[], max: number): T[] {
  const capped = Math.min(items.length, max);
  const even = Math.floor(capped / 2) * 2;
  return items.slice(0, even);
}

/** Article ids that have saved AI / fact-check analysis. */
async function getArticleIdsWithCredibilityAnalysis(articleIds: string[]): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("article_credibility_analysis")
    .select("article_id")
    .in("article_id", articleIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: { article_id: string }) => r.article_id));
}

/** Fetch published articles (home, search). Optional: filter by category slug, text search, limit, offset. */
export async function getPublishedArticles(options?: {
  categorySlug?: string;
  tag?: string;
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

  if (options?.tag?.trim()) {
    const normalizedTag = options.tag.trim().toLowerCase();
    query = query.contains("tags", [normalizedTag]);
  }

  if (options?.q?.trim()) {
    const raw = options.q.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const term = `"%${raw}%"`;
    query = query.or(`title.ilike.${term},excerpt.ilike.${term},content.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const articles = (data ?? []) as ArticleWithCategory[];
  if (articles.length === 0) return [];

  const articleIds = articles.map((a) => a.id);
  const { data: commentRows, error: commentErr } = await supabase
    .from("comments")
    .select("article_id")
    .in("article_id", articleIds)
    .eq("status", "active");
  if (commentErr) throw commentErr;

  const commentCountMap = new Map<string, number>();
  for (const row of commentRows ?? []) {
    const key = (row as { article_id: string }).article_id;
    commentCountMap.set(key, (commentCountMap.get(key) ?? 0) + 1);
  }

  const analysisSet = await getArticleIdsWithCredibilityAnalysis(articleIds);

  return articles.map((article) => ({
    ...article,
    commentsCount: commentCountMap.get(article.id) ?? 0,
    hasCredibilityAnalysis: analysisSet.has(article.id),
  }));
}

/** Fetch a single article by id (respects RLS). Uses maybeSingle so missing rows do not produce HTTP 406. */
export async function getArticleById(id: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(id, name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ArticleWithCategory | null;
}

/**
 * Admin Content Moderation preview: full article + category regardless of status,
 * via SECURITY DEFINER RPC (avoids 406 / empty result when direct select is not visible under RLS).
 */
export async function getArticleByIdForAdminPreview(id: string): Promise<ArticleWithCategory | null> {
  const { data, error } = await supabase.rpc("admin_get_article_preview", { p_article_id: id });
  if (error) {
    const code = (error as { code?: string }).code;
    const msg = error.message ?? "";
    if (code === "42883" || msg.includes("admin_get_article_preview")) {
      return getArticleById(id);
    }
    throw error;
  }
  return (data ?? null) as ArticleWithCategory | null;
}

/**
 * "Also read": only published articles in the **same category** as the current article.
 * Never mixes other categories; if fewer than `limit` exist, returns fewer (no backfill).
 * Within the category, when the current article has tags, sorts by shared-tag count then date.
 * Returns only an **even** count (0, 2, 4, or up to `limit`) so the 2-column layout never shows an odd last row.
 */
export async function getRelatedArticles(options: {
  excludeArticleId: string;
  categoryId: string | null;
  articleTags?: string[] | null;
  limit?: number;
}): Promise<ArticleWithCategory[]> {
  const limit = options.limit ?? 6;
  if (!options.categoryId) return [];

  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug)")
    .eq("status", "published")
    .eq("category_id", options.categoryId)
    .neq("id", options.excludeArticleId)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as ArticleWithCategory[];
  const currentTags = normalizeArticleTags(options.articleTags);

  if (currentTags.length > 0) {
    const scored = rows.map((a) => ({
      a,
      overlap: tagOverlapCount(currentTags, normalizeArticleTags(a.tags)),
    }));
    scored.sort((x, y) => {
      if (y.overlap !== x.overlap) return y.overlap - x.overlap;
      const tx = new Date(x.a.published_at ?? x.a.created_at ?? 0).getTime();
      const ty = new Date(y.a.published_at ?? y.a.created_at ?? 0).getTime();
      return ty - tx;
    });
    return takeEvenAlsoReadCount(
      scored.map((s) => s.a).slice(0, limit),
      limit
    );
  }

  return takeEvenAlsoReadCount(rows.slice(0, limit), limit);
}

/** Increment article view count (call when viewing detail page). */
export async function incrementArticleViews(id: string) {
  const { data: row, error: rowErr } = await supabase.from("articles").select("views").eq("id", id).maybeSingle();
  if (rowErr || !row) return;
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
  tags?: string[] | null;
}) {
  const tags = normalizeArticleTags(insert.tags ?? []);
  const { data, error } = await supabase
    .from("articles")
    .insert({
      ...insert,
      tags,
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
  updates: Partial<
    Pick<
      ArticleRow,
      | "title"
      | "excerpt"
      | "content"
      | "image_url"
      | "author_display_name"
      | "author_bio"
      | "category_id"
      | "status"
      | "submitted_at"
      | "rejection_reason"
      | "tags"
    >
  >
) {
  const payload =
    updates.tags !== undefined
      ? { ...updates, tags: normalizeArticleTags(updates.tags) }
      : updates;
  const { data, error } = await supabase.from("articles").update(payload).eq("id", id).select().single();
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

/** Category IDs matching an expert's approved `expert_applications.expertise` strings (same rules as legacy expert queue). */
export async function getExpertApprovedCategoryIds(expertId: string): Promise<string[]> {
  const { data: expertiseRows, error: expertiseErr } = await supabase
    .from("expert_applications")
    .select("expertise")
    .eq("user_id", expertId)
    .eq("status", "approved");
  if (expertiseErr) throw expertiseErr;

  const approvedExpertise = Array.from(
    new Set(
      (expertiseRows ?? [])
        .flatMap((row) =>
          ((row as { expertise?: string | null }).expertise ?? "")
            .split(",")
            .map((value) => value.trim())
        )
        .filter((value) => value.length > 0)
    )
  );
  if (approvedExpertise.length === 0) return [];

  const { data: categories, error: categoriesErr } = await supabase.from("categories").select("id, name, slug");
  if (categoriesErr) throw categoriesErr;
  const normalizedExpertise = approvedExpertise.map((value) => value.toLowerCase());
  return Array.from(
    new Set(
      (categories ?? [])
        .filter((category) => {
          const normalizedName = (category as { name: string }).name.toLowerCase();
          const normalizedSlug = (category as { slug: string }).slug.toLowerCase();
          return normalizedExpertise.some((entry) => {
            const slugified = entry.replace(/\s+/g, "-");
            return entry === normalizedName || entry === normalizedSlug || slugified === normalizedSlug;
          });
        })
        .map((category) => (category as { id: string }).id)
    )
  );
}

/** This expert's `expert_reviews` row for an article, if any. */
export async function getMyExpertReviewForArticle(
  articleId: string,
  expertId: string
): Promise<ExpertReviewRow | null> {
  const { data, error } = await supabase
    .from("expert_reviews")
    .select("*")
    .eq("article_id", articleId)
    .eq("expert_id", expertId)
    .maybeSingle();
  if (error) throw error;
  return data as ExpertReviewRow | null;
}

/**
 * The published expert review all readers should see (approved decision on a published article).
 * Prefer the row for `articles.expert_reviewer_id` when set; otherwise the latest approved review.
 */
export async function getPublishedExpertReviewForArticle(
  articleId: string,
  expertReviewerId: string | null | undefined
): Promise<ExpertReviewRow | null> {
  if (expertReviewerId) {
    const { data, error } = await supabase
      .from("expert_reviews")
      .select("*")
      .eq("article_id", articleId)
      .eq("expert_id", expertReviewerId)
      .eq("decision", "approved")
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ExpertReviewRow;
  }
  const { data, error } = await supabase
    .from("expert_reviews")
    .select("*")
    .eq("article_id", articleId)
    .eq("decision", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ExpertReviewRow | null;
}

/** True when credentials are not real applicant text (e.g. admin back-fill). */
function isPlaceholderExpertCredentials(raw: string | null | undefined): boolean {
  const s = raw?.trim() ?? "";
  if (!s) return true;
  return /^added by admin(istrator)?$/i.test(s);
}

/** Display label from approved application: prefer real applicant `credentials`, else expertise areas. */
export async function getApprovedExpertProfileLabel(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("expert_applications")
    .select("expertise, credentials, applied_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("applied_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return null;

  const cred = data
    .map((r) => r.credentials?.trim())
    .find((c) => c && !isPlaceholderExpertCredentials(c));
  if (cred) return cred;

  const areas = [
    ...new Set(
      data.flatMap((r) =>
        (r.expertise ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ),
  ];
  if (areas.length) return `Expert in ${areas.join(", ")}`;
  return "Verified expert";
}

export type ExpertDashboardArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  published_at: string | null;
  image_url: string | null;
  category: { name: string } | null;
  status: ArticleStatus;
  /** This expert's latest recorded decision for this article, if any */
  myReviewDecision: "approved" | "rejected" | null;
};

const expertDashboardArticleSelect =
  "id, status, title, excerpt, author_display_name, created_at, updated_at, submitted_at, published_at, image_url, category:categories(name)";

/**
 * Published articles in this expert's categories, plus rejected articles this expert reviewed (so they can edit/delete).
 * Includes `myReviewDecision` when this expert has already submitted a review.
 */
export async function getExpertDashboardArticles(expertId: string, limit = 200): Promise<ExpertDashboardArticle[]> {
  const categoryIds = await getExpertApprovedCategoryIds(expertId);

  const { data: rejectedReviewRows, error: rejRevErr } = await supabase
    .from("expert_reviews")
    .select("article_id")
    .eq("expert_id", expertId)
    .eq("decision", "rejected");
  if (rejRevErr) throw rejRevErr;
  const rejectedArticleIds = Array.from(
    new Set((rejectedReviewRows ?? []).map((r: { article_id: string }) => r.article_id)),
  );

  type Row = Omit<ExpertDashboardArticle, "myReviewDecision">;
  const byId = new Map<string, Row>();

  if (categoryIds.length > 0) {
    const { data: pub, error } = await supabase
      .from("articles")
      .select(expertDashboardArticleSelect)
      .eq("status", "published")
      .in("category_id", categoryIds)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    for (const r of (pub ?? []) as Row[]) byId.set(r.id, r);
  }

  if (rejectedArticleIds.length > 0) {
    const { data: rejArticles, error: rejArtErr } = await supabase
      .from("articles")
      .select(expertDashboardArticleSelect)
      .eq("status", "rejected")
      .in("id", rejectedArticleIds);
    if (rejArtErr) throw rejArtErr;
    for (const r of (rejArticles ?? []) as Row[]) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
  }

  if (byId.size === 0) return [];

  const rows = Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.published_at ?? a.submitted_at ?? a.created_at).getTime();
    const tb = new Date(b.published_at ?? b.submitted_at ?? b.created_at).getTime();
    return tb - ta;
  });

  const ids = rows.map((r) => r.id);
  const { data: reviews, error: revErr } = await supabase
    .from("expert_reviews")
    .select("article_id, decision")
    .eq("expert_id", expertId)
    .in("article_id", ids);
  if (revErr) throw revErr;
  const decisionByArticle = new Map<string, "approved" | "rejected">();
  for (const r of reviews ?? []) {
    const row = r as { article_id: string; decision: string };
    decisionByArticle.set(row.article_id, row.decision as "approved" | "rejected");
  }

  return rows.map((r) => ({
    ...r,
    myReviewDecision: decisionByArticle.get(r.id) ?? null,
  }));
}

/** @deprecated Use getExpertDashboardArticles — kept for any external callers. */
export async function getExpertPendingArticles(expertId: string) {
  const all = await getExpertDashboardArticles(expertId, 200);
  return all.filter((a) => a.myReviewDecision !== "approved");
}

/** Optional fields from verify-claim-source before expert_reviews upsert. */
export type ExpertReviewSourceVerification = {
  url: string;
  sourceTitle: string;
  sourceCredibility: string;
  aiVerdict: string;
  reason: string;
};

/** Rebuild verification list from a stored expert_reviews row (for edit / precheck seeding). */
export function expertReviewStoredVerifications(review: ExpertReviewRow): ExpertReviewSourceVerification[] {
  const refs = review.source_references;
  if (Array.isArray(refs) && refs.length > 0) {
    const out: ExpertReviewSourceVerification[] = [];
    for (const x of refs) {
      if (x && typeof x === "object" && "url" in x && typeof (x as { url: unknown }).url === "string") {
        const o = x as Record<string, unknown>;
        out.push({
          url: String(o.url),
          sourceTitle: typeof o.sourceTitle === "string" ? o.sourceTitle : "",
          sourceCredibility: typeof o.sourceCredibility === "string" ? o.sourceCredibility : "—",
          aiVerdict: typeof o.aiVerdict === "string" ? o.aiVerdict : "—",
          reason: typeof o.reason === "string" ? o.reason : "",
        });
      }
    }
    if (out.length > 0) return out;
  }
  if (review.source_url) {
    return [
      {
        url: review.source_url,
        sourceTitle: review.source_title ?? "",
        sourceCredibility: review.source_credibility ?? "—",
        aiVerdict: review.source_ai_verdict ?? "—",
        reason: review.source_check_reason ?? "",
      },
    ];
  }
  return [];
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
    /** One or more verified sources (same shape as comments). */
    sourceVerifications?: ExpertReviewSourceVerification[] | null;
    /** Shown to all readers on the article page (stored on the review row). */
    expertDisplayName?: string | null;
    expertAvatar?: string | null;
  }
) {
  const list = params.sourceVerifications ?? [];
  const reviewRow = {
    article_id: articleId,
    expert_id: expertId,
    credibility_score: params.credibilityScore,
    factual_accuracy: params.factualAccuracy ?? null,
    rating: params.rating ?? null,
    comments: params.comments ?? null,
    flagged: params.flagged ?? false,
    decision: params.decision,
    reviewed_at: new Date().toISOString(),
    expert_display_name: params.expertDisplayName?.trim() || null,
    expert_avatar: params.expertAvatar?.trim() || null,
    ...(list.length > 0
      ? {
          source_url: list[0].url,
          source_title: list.length > 1 ? `${list.length} sources` : list[0].sourceTitle,
          source_credibility: list[0].sourceCredibility,
          source_ai_verdict: list.every((s) => s.aiVerdict === "SUPPORT") ? "SUPPORT" : list[0].aiVerdict,
          source_check_reason:
            list.length > 1
              ? `${list.length} links checked (all SUPPORT). First: ${list[0].reason}`
              : list[0].reason,
          source_references: list,
        }
      : {}),
  };
  const { error: reviewErr } = await supabase.from("expert_reviews").upsert(reviewRow, {
    onConflict: "article_id,expert_id",
  });
  if (reviewErr) throw reviewErr;

  const { data: art, error: artFetchErr } = await supabase
    .from("articles")
    .select("status")
    .eq("id", articleId)
    .maybeSingle();
  if (artFetchErr) throw artFetchErr;

  const updates =
    params.decision === "approved"
      ? art?.status === "published"
        ? {
            credibility_score: params.credibilityScore,
            is_verified: true,
            expert_reviewer_id: expertId,
            rejection_reason: null,
          }
        : {
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

/**
 * Remove this expert's review row and fix article state: published → drop verification;
 * rejected (by this expert) → return article to pending for another pass.
 */
export async function withdrawExpertReview(articleId: string, expertId: string): Promise<void> {
  const review = await getMyExpertReviewForArticle(articleId, expertId);
  if (!review) throw new Error("No review found to remove.");

  const { data: article, error: aErr } = await supabase
    .from("articles")
    .select("status, expert_reviewer_id")
    .eq("id", articleId)
    .maybeSingle();
  if (aErr) throw aErr;

  if (review.decision === "approved" && article?.status === "published") {
    const { error } = await supabase
      .from("articles")
      .update({
        is_verified: false,
        expert_reviewer_id: null,
        credibility_score: null,
      })
      .eq("id", articleId)
      .eq("expert_reviewer_id", expertId);
    if (error) throw error;
  } else if (review.decision === "rejected" && article?.status === "rejected") {
    const { error } = await supabase
      .from("articles")
      .update({
        status: "pending",
        rejection_reason: null,
      })
      .eq("id", articleId);
    if (error) throw error;
  }

  const { error: delErr } = await supabase
    .from("expert_reviews")
    .delete()
    .eq("article_id", articleId)
    .eq("expert_id", expertId);
  if (delErr) throw delErr;
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

/** Trending ranking based on views then comment count. */
export async function getTrendingArticles(limit = 5): Promise<TrendingArticleItem[]> {
  const fetchSize = Math.max(limit * 4, 20);
  const { data: rows, error } = await supabase
    .from("articles")
    .select("id, title, views, published_at, category:categories(name)")
    .eq("status", "published")
    .order("views", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(fetchSize);

  if (error) throw error;
  const articles = (rows ?? []) as {
    id: string;
    title: string;
    views: number | null;
    published_at: string | null;
    category?: { name?: string } | null;
  }[];

  if (articles.length === 0) return [];

  const articleIds = articles.map((a) => a.id);
  const { data: commentRows, error: commentErr } = await supabase
    .from("comments")
    .select("article_id")
    .in("article_id", articleIds)
    .eq("status", "active");
  if (commentErr) throw commentErr;

  const commentCountMap = new Map<string, number>();
  for (const row of commentRows ?? []) {
    const key = (row as { article_id: string }).article_id;
    commentCountMap.set(key, (commentCountMap.get(key) ?? 0) + 1);
  }

  return articles
    .map((a) => ({
      id: a.id,
      title: a.title,
      category: (a.category as { name?: string } | null)?.name ?? "Uncategorized",
      views: a.views ?? 0,
      comments: commentCountMap.get(a.id) ?? 0,
      publishedAt: a.published_at ?? null,
      publishedAtTs: a.published_at ? new Date(a.published_at).getTime() : 0,
    }))
    .sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      if (b.comments !== a.comments) return b.comments - a.comments;
      return b.publishedAtTs - a.publishedAtTs;
    })
    .slice(0, limit)
    .map(({ publishedAtTs, ...item }) => item);
}
