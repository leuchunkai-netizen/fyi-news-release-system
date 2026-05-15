import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { CheckCircle, XCircle, AlertTriangle, Eye, Star, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import { useUser } from "../context/UserContext";
import {
  getExpertDashboardArticles,
  getMyExpertReviewForArticle,
  submitExpertReview,
  withdrawExpertReview,
  expertReviewStoredVerifications,
  type ExpertDashboardArticle,
  type ExpertReviewSourceVerification,
} from "../../lib/api/articles";
import type { ExpertReviewRow } from "../../lib/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { verifyClaimSource } from "../../lib/api/factcheck";
import {
  MAX_EXPERT_SOURCE_URLS,
  formatUrlForDisplay,
  parseSourceUrlInputs,
  sourceUrlInputsFingerprint,
} from "../../lib/sourceUrls";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Claim used when clicking Check source (same text must still match when you submit). */
function claimForSourcePrecheck(article: ExpertDashboardArticle, comments: string): string {
  const c = comments.trim();
  if (c.length >= 12) return c;
  return `Expert review (scores and ratings) for the article: ${article.title}`;
}

export function ExpertDashboard() {
  const { user } = useUser();
  const location = useLocation();
  const [articles, setArticles] = useState<ExpertDashboardArticle[]>([]);
  const [listFilter, setListFilter] = useState<"all" | "needs_review" | "reviewed">("needs_review");
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState({
    rating: 0,
    credibilityScore: 0,
    factualAccuracy: 0,
    comments: "",
    /** One text box per source URL; use “Add another source” for more. */
    sourceUrls: [""] as string[],
    flagged: false,
  });
  const [submitting, setSubmitting] = useState(false);
  /** Last successful Check source for the open review form (invalid if URL/comments/article change). */
  const [reviewSourcePrecheck, setReviewSourcePrecheck] = useState<{
    articleId: string;
    urlsKey: string;
    commentsSnapshot: string;
    verifications: ExpertReviewSourceVerification[];
  } | null>(null);
  const [reviewSourceCheckBusy, setReviewSourceCheckBusy] = useState(false);
  const [reviewSourceCheckNote, setReviewSourceCheckNote] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewReviewLoading, setViewReviewLoading] = useState(false);
  const [viewReview, setViewReview] = useState<ExpertReviewRow | null>(null);
  const [viewArticleTitle, setViewArticleTitle] = useState("");
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);

  const loadArticles = useCallback(() => {
    if (!user || user.role !== "expert") return;
    setLoading(true);
    getExpertDashboardArticles(user.id)
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles, location.pathname]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadArticles();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadArticles]);

  useEffect(() => {
    if (!reviewSourcePrecheck) return;
    if (
      sourceUrlInputsFingerprint(reviewData.sourceUrls) !== reviewSourcePrecheck.urlsKey ||
      reviewData.comments.trim() !== reviewSourcePrecheck.commentsSnapshot
    ) {
      setReviewSourcePrecheck(null);
      setReviewSourceCheckNote(null);
    }
  }, [reviewData.sourceUrls, reviewData.comments, reviewSourcePrecheck]);

  const pendingQueue = articles.filter((a) => a.status === "pending" && a.myReviewDecision == null);

  const visibleArticles =
    listFilter === "needs_review"
      ? pendingQueue
      : listFilter === "reviewed"
        ? articles.filter((a) => a.myReviewDecision != null)
        : articles;

  function starRatingFromStored(rating: number | null): number {
    const r = rating ?? 0;
    if (r > 0 && r <= 5) return r;
    return Math.min(5, Math.max(0, Math.round(r / 20)));
  }

  const openViewReview = async (article: ExpertDashboardArticle) => {
    if (!user) return;
    setViewArticleTitle(article.title);
    setViewDialogOpen(true);
    setViewReviewLoading(true);
    setViewReview(null);
    try {
      const rev = await getMyExpertReviewForArticle(article.id, user.id);
      setViewReview(rev);
    } catch {
      setViewReview(null);
    } finally {
      setViewReviewLoading(false);
    }
  };

  const openEditReview = async (article: ExpertDashboardArticle) => {
    if (!user) return;
    try {
      const rev = await getMyExpertReviewForArticle(article.id, user.id);
      if (!rev) {
        alert("Could not load your review.");
        return;
      }
      const verifications = expertReviewStoredVerifications(rev);
      const sourceUrls =
        verifications.length > 0 ? verifications.map((v) => v.url) : rev.source_url ? [rev.source_url] : [""];
      setReviewData({
        rating: starRatingFromStored(rev.rating),
        credibilityScore: rev.credibility_score,
        factualAccuracy: rev.factual_accuracy ?? 0,
        comments: rev.comments ?? "",
        sourceUrls,
        flagged: rev.flagged,
      });
      const snapComments = (rev.comments ?? "").trim();
      if (verifications.length > 0) {
        setReviewSourcePrecheck({
          articleId: article.id,
          urlsKey: sourceUrlInputsFingerprint(sourceUrls),
          commentsSnapshot: snapComments,
          verifications,
        });
        setReviewSourceCheckNote(
          "Loaded your saved sources. If you change comments or URLs, click Check all sources again before submitting.",
        );
      } else {
        setReviewSourcePrecheck(null);
        setReviewSourceCheckNote(null);
      }
      setSelectedArticle(article.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not load your review.");
    }
  };

  const handleDeleteReview = async (article: ExpertDashboardArticle) => {
    if (!user) return;
    const detail =
      article.myReviewDecision === "approved"
        ? "The article will stay published but will no longer show as expert-verified."
        : "The article will return to the pending queue for another review.";
    if (!window.confirm(`Remove your expert review for this article?\n\n${detail}`)) return;
    setDeletingArticleId(article.id);
    try {
      await withdrawExpertReview(article.id, user.id);
      if (selectedArticle === article.id) {
        setSelectedArticle(null);
        setReviewData(emptyReview());
        clearReviewSourceCheck();
      }
      loadArticles();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove review.");
    } finally {
      setDeletingArticleId(null);
    }
  };

  if (!user || user.role !== "expert") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">This page is only accessible to verified experts.</p>
      </div>
    );
  }

  const emptyReview = () => ({
    rating: 0,
    credibilityScore: 0,
    factualAccuracy: 0,
    comments: "",
    sourceUrls: [""] as string[],
    flagged: false,
  });

  const clearReviewSourceCheck = () => {
    setReviewSourcePrecheck(null);
    setReviewSourceCheckNote(null);
  };

  const handleCheckReviewSource = async (article: ExpertDashboardArticle) => {
    const urls = parseSourceUrlInputs(reviewData.sourceUrls);
    if (urls.length === 0) {
      alert(`Enter at least one full URL (https://…) in a source box. Up to ${MAX_EXPERT_SOURCE_URLS} sources.`);
      return;
    }
    setReviewSourceCheckBusy(true);
    setReviewSourceCheckNote(null);
    try {
      const claim = claimForSourcePrecheck(article, reviewData.comments);
      const verifications: ExpertReviewSourceVerification[] = [];
      for (let i = 0; i < urls.length; i++) {
        const submittedUrl = urls[i];
        let v: Awaited<ReturnType<typeof verifyClaimSource>>;
        try {
          v = await verifyClaimSource({ claim, sourceUrl: submittedUrl });
        } catch (e) {
          setReviewSourcePrecheck(null);
          const msg = e instanceof Error ? e.message : "Request failed";
          setReviewSourceCheckNote(
            `Did not pass — error while checking source #${i + 1} of ${urls.length}: ${formatUrlForDisplay(submittedUrl)}. ${msg}`,
          );
          return;
        }
        if (v.aiVerdict === "CONTRADICT") {
          setReviewSourcePrecheck(null);
          setReviewSourceCheckNote(
            `Did not pass — source #${i + 1} of ${urls.length} (CONTRADICT): ${formatUrlForDisplay(submittedUrl)}. Remove or replace this link and run Check all sources again.`,
          );
          return;
        }
        if (v.aiVerdict !== "SUPPORT") {
          setReviewSourcePrecheck(null);
          setReviewSourceCheckNote(
            `Did not pass — source #${i + 1} of ${urls.length} (${v.aiVerdict}): ${formatUrlForDisplay(submittedUrl)}. Fix or remove this link and run Check all sources again.`,
          );
          return;
        }
        verifications.push({
          url: v.url,
          sourceTitle: v.sourceTitle,
          sourceCredibility: v.sourceCredibility,
          aiVerdict: v.aiVerdict,
          reason: v.reason,
        });
      }
      setReviewSourcePrecheck({
        articleId: article.id,
        urlsKey: sourceUrlInputsFingerprint(reviewData.sourceUrls),
        commentsSnapshot: reviewData.comments.trim(),
        verifications,
      });
      setReviewSourceCheckNote(
        `${urls.length} source${urls.length > 1 ? "s" : ""} checked in one pass — all support your review. You can submit.`,
      );
    } catch (err) {
      setReviewSourcePrecheck(null);
      setReviewSourceCheckNote(err instanceof Error ? err.message : "Check failed.");
    } finally {
      setReviewSourceCheckBusy(false);
    }
  };

  const assertPrecheckValidForArticle = (articleId: string): boolean => {
    if (
      !reviewSourcePrecheck ||
      reviewSourcePrecheck.articleId !== articleId ||
      sourceUrlInputsFingerprint(reviewData.sourceUrls) !== reviewSourcePrecheck.urlsKey ||
      reviewData.comments.trim() !== reviewSourcePrecheck.commentsSnapshot
    ) {
      alert(
        "Click Check all sources and pass before submitting. If you edited any source URL or Review comments, check again.",
      );
      return false;
    }
    return true;
  };

  const handleApprove = async (articleId: string) => {
    if (!assertPrecheckValidForArticle(articleId)) return;
    setSubmitting(true);
    try {
      await submitExpertReview(articleId, user.id, {
        decision: "approved",
        credibilityScore: reviewData.credibilityScore,
        factualAccuracy: reviewData.factualAccuracy || null,
        rating: reviewData.rating || null,
        comments: reviewData.comments.trim() || null,
        flagged: reviewData.flagged,
        sourceVerifications: reviewSourcePrecheck!.verifications,
        expertDisplayName: user.name,
        expertAvatar: user.avatar ?? null,
      });
      setSelectedArticle(null);
      setReviewData(emptyReview());
      clearReviewSourceCheck();
      loadArticles();
      alert("Article approved and published.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (articleId: string) => {
    if (reviewData.comments.trim() === "") {
      alert("Please provide comments explaining the rejection");
      return;
    }
    if (!assertPrecheckValidForArticle(articleId)) return;
    setSubmitting(true);
    try {
      await submitExpertReview(articleId, user.id, {
        decision: "rejected",
        credibilityScore: reviewData.credibilityScore,
        factualAccuracy: reviewData.factualAccuracy || null,
        rating: reviewData.rating || null,
        comments: reviewData.comments.trim(),
        flagged: reviewData.flagged,
        sourceVerifications: reviewSourcePrecheck!.verifications,
        expertDisplayName: user.name,
        expertAvatar: user.avatar ?? null,
      });
      setSelectedArticle(null);
      setReviewData(emptyReview());
      clearReviewSourceCheck();
      loadArticles();
      alert("Article rejected.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlag = (articleId: string) => {
    setReviewData((prev) => ({ ...prev, flagged: true }));
    alert("Article marked as flagged. Add comments and reject or approve with flag set.");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Expert Review Dashboard</h1>
          <p className="text-muted-foreground">
            Articles waiting for review in your approved expertise categories appear here first. Open the review form to
            approve or reject; your latest review for each article is kept.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-muted-foreground">Show:</span>
          <button
            type="button"
            onClick={() => setListFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${listFilter === "all" ? "bg-red-600 text-white border-red-600" : "bg-white hover:bg-gray-50"}`}
          >
            All ({articles.length})
          </button>
          <button
            type="button"
            onClick={() => setListFilter("needs_review")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${listFilter === "needs_review" ? "bg-red-600 text-white border-red-600" : "bg-white hover:bg-gray-50"}`}
          >
            Awaiting review ({pendingQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setListFilter("reviewed")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${listFilter === "reviewed" ? "bg-red-600 text-white border-red-600" : "bg-white hover:bg-gray-50"}`}
          >
            My reviews ({articles.filter((a) => a.myReviewDecision != null).length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Awaiting review</p>
            <p className="text-3xl font-bold">{loading ? "—" : pendingQueue.length}</p>
          </div>
          <div className="border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">My reviews</p>
            <p className="text-3xl font-bold">
              {loading ? "—" : articles.filter((a) => a.myReviewDecision != null).length}
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Showing</p>
            <p className="text-3xl font-bold">{loading ? "—" : visibleArticles.length}</p>
          </div>
        </div>

        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Expert review queue</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : visibleArticles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <p>No articles match this filter.</p>
              {articles.length === 0 && !loading && (
                <p className="text-sm max-w-md mx-auto">
                  If you expected stories here, confirm your expert application is approved and your expertise areas match
                  a category name or slug on the site.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {visibleArticles.map((article) => (
                <div key={article.id} className="p-6">
                  <div className="flex gap-6">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-48 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-48 h-32 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-sm">
                        No image
                      </div>
                    )}
                    <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold">{article.title}</h3>
                            {article.myReviewDecision === "approved" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">You approved</span>
                            )}
                            {article.myReviewDecision === "rejected" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">You rejected</span>
                            )}
                            {article.status === "pending" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">Under review</span>
                            )}
                            {article.myReviewDecision == null && article.status !== "pending" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">No review from you yet</span>
                            )}
                            {article.status === "rejected" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">Article rejected</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {article.category?.name ?? "Uncategorized"}
                            </span>
                            <span>By {article.author_display_name ?? "Unknown"}</span>
                            <span>
                              •{" "}
                              {article.status === "pending"
                                ? `Submitted ${formatDate(article.submitted_at ?? article.created_at)}`
                                : article.status === "rejected"
                                  ? `Rejected ${formatDate(article.updated_at ?? article.submitted_at ?? article.created_at)}`
                                  : `Published ${formatDate(article.published_at ?? article.submitted_at ?? article.created_at)}`}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{article.excerpt ?? ""}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <Link
                          to={`/article/${article.id}`}
                          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium text-slate-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View article
                        </Link>
                        {article.myReviewDecision != null ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openViewReview(article)}
                              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 text-sm"
                            >
                              <Eye className="w-4 h-4" />
                              View review
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditReview(article)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit review
                            </button>
                            <button
                              type="button"
                              disabled={deletingArticleId === article.id}
                              onClick={() => handleDeleteReview(article)}
                              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 flex items-center gap-2 text-sm disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingArticleId === article.id ? "Removing…" : "Delete review"}
                            </button>
                          </>
                        ) : article.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedArticle === article.id) {
                                setSelectedArticle(null);
                                clearReviewSourceCheck();
                                setReviewData(emptyReview());
                              } else {
                                clearReviewSourceCheck();
                                setReviewData(emptyReview());
                                setSelectedArticle(article.id);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            {selectedArticle === article.id ? "Hide review form" : "Review & decide"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedArticle === article.id) {
                                setSelectedArticle(null);
                                clearReviewSourceCheck();
                                setReviewData(emptyReview());
                              } else {
                                clearReviewSourceCheck();
                                setReviewData(emptyReview());
                                setSelectedArticle(article.id);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            {selectedArticle === article.id ? "Hide review form" : "Review article"}
                          </button>
                        )}
                      </div>

                      {selectedArticle === article.id && (
                        <div className="mt-6 border-t pt-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Expert Rating (1-5)</label>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                                    className="focus:outline-none"
                                  >
                                    <Star
                                      className={`w-6 h-6 ${
                                        star <= reviewData.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Credibility Score (0-100)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={reviewData.credibilityScore || ""}
                                onChange={(e) =>
                                  setReviewData({ ...reviewData, credibilityScore: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="0-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Factual Accuracy (0-100)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={reviewData.factualAccuracy || ""}
                                onChange={(e) =>
                                  setReviewData({ ...reviewData, factualAccuracy: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                                placeholder="0-100"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Review Comments</label>
                            <textarea
                              value={reviewData.comments}
                              onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
                              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              rows={4}
                              placeholder="Provide detailed feedback (required for rejection)..."
                            />
                          </div>

                          <div>
                            <p className="block text-sm font-medium mb-2">Sources</p>
                            <div className="space-y-2">
                              {reviewData.sourceUrls.map((urlVal, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <input
                                    type="url"
                                    id={idx === 0 ? `expert-review-source-${article.id}` : undefined}
                                    value={urlVal}
                                    onChange={(e) => {
                                      const next = [...reviewData.sourceUrls];
                                      next[idx] = e.target.value;
                                      setReviewData({ ...reviewData, sourceUrls: next });
                                    }}
                                    className="min-w-0 flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                                    placeholder="https://…"
                                  />
                                  {reviewData.sourceUrls.length > 1 ? (
                                    <button
                                      type="button"
                                      title="Remove this source box"
                                      onClick={() => {
                                        const next = reviewData.sourceUrls.filter((_, i) => i !== idx);
                                        setReviewData({ ...reviewData, sourceUrls: next.length ? next : [""] });
                                      }}
                                      className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={reviewData.sourceUrls.length >= MAX_EXPERT_SOURCE_URLS}
                                onClick={() =>
                                  setReviewData({
                                    ...reviewData,
                                    sourceUrls: [...reviewData.sourceUrls, ""],
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-400 bg-blue-50/50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <Plus className="h-4 w-4" />
                                Add another source
                              </button>
                              <button
                                type="button"
                                disabled={reviewSourceCheckBusy || submitting}
                                onClick={() => handleCheckReviewSource(article)}
                                className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              >
                                {reviewSourceCheckBusy ? "Checking all…" : "Check all sources"}
                              </button>
                            </div>
                            {reviewSourceCheckNote ? (
                              <p
                                className={`mt-2 text-xs ${reviewSourcePrecheck ? "text-green-700" : "text-red-600"}`}
                              >
                                {reviewSourceCheckNote}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground mt-1">
                              Each box is one link (https://…), up to {MAX_EXPERT_SOURCE_URLS}.{" "}
                              <span className="font-medium">Check all sources</span> verifies every box in one go; each must
                              SUPPORT your review. Changing URLs or comments clears the check.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleApprove(article.id)}
                              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve & Publish
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleReject(article.id)}
                              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFlag(article.id)}
                              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Flag as Suspicious
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) {
            setViewReview(null);
            setViewArticleTitle("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your review</DialogTitle>
            <DialogDescription className="line-clamp-3">{viewArticleTitle}</DialogDescription>
          </DialogHeader>
          {viewReviewLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : viewReview ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                    viewReview.decision === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {viewReview.decision}
                </span>
                {viewReview.flagged ? (
                  <span className="text-xs font-medium text-orange-800 bg-orange-50 px-2 py-0.5 rounded">Flagged</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {formatDate(viewReview.reviewed_at)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <p>
                  Credibility: <strong className="text-slate-900">{viewReview.credibility_score}</strong>
                </p>
                {viewReview.factual_accuracy != null ? (
                  <p>
                    Factual accuracy: <strong className="text-slate-900">{viewReview.factual_accuracy}</strong>
                  </p>
                ) : null}
                {viewReview.rating != null ? (
                  <p>
                    Rating: <strong className="text-slate-900">{starRatingFromStored(viewReview.rating)}</strong> / 5
                  </p>
                ) : null}
              </div>
              {viewReview.comments?.trim() ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Comments</p>
                  <p className="text-slate-800 whitespace-pre-wrap">{viewReview.comments}</p>
                </div>
              ) : null}
              {expertReviewStoredVerifications(viewReview).filter((s) => String(s.aiVerdict).toUpperCase() === "SUPPORT")
                .length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sources</p>
                  <ul className="space-y-2">
                    {expertReviewStoredVerifications(viewReview)
                      .filter((s) => String(s.aiVerdict).toUpperCase() === "SUPPORT")
                      .map((s, i) => (
                      <li key={i} className="border rounded-lg p-2 text-xs break-all">
                        <a href={s.url} className="text-red-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                          {s.sourceTitle || s.url}
                        </a>
                        <p className="text-muted-foreground mt-1">
                          {s.sourceCredibility} · {s.aiVerdict}
                        </p>
                        {s.reason ? <p className="mt-1">{s.reason}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this review.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
