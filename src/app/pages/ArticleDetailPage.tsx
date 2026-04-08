import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Clock, Bookmark, Share2, Sparkles, Flag, CheckCircle, MessageCircle, Facebook, Twitter, Linkedin, AlertTriangle, Info, Eye, Trash2, Download } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getArticleById, getCredibilityAnalysis, getRelatedArticles, incrementArticleViews } from "../../lib/api/articles";
import { tryRecordPremiumArticleRead } from "../../lib/api/readHistory";
import { downloadOfflineArticleFile } from "../../lib/downloadArticleHtml";
import { fetchArticleSummary, type ArticleSummaryResult } from "../../lib/api/summary";
import { getComments, addComment, deleteComment, reportComment } from "../../lib/api/comments";
import { addBookmark, removeBookmark, isBookmarked } from "../../lib/api/bookmarks";
import type { ArticleWithCategory } from "../../lib/api/articles";
import type { CommentWithAuthor } from "../../lib/api/comments";
import { UserAvatar } from "../components/UserAvatar";
import { RelatedRecommendationsGrid } from "../components/RelatedRecommendationsGrid";

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "Just now";
  if (sec < 3600) {
    const mins = Math.floor(sec / 60);
    return `${mins}m ago`;
  }
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}

interface RejectionFinding {
  snippet: string;
  issue: string;
  reason: string;
  severity: "high" | "medium";
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function asStringArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildSampleRejectionFindings(content: string, concerns: string[], warnings: string[]): RejectionFinding[] {
  const plain = stripHtml(content);
  const sentences = (plain.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);

  const fallbackSnippets = [
    "A core claim in this article appears definitive but lacks verifiable sourcing in the submitted text.",
    "Another key statement relies on broad certainty without enough supporting evidence or attribution.",
  ];

  return [0, 1].map((index) => {
    const snippet = sentences[index] ?? fallbackSnippets[index];
    const guidance = warnings[index] ?? concerns[index] ?? "This claim needs stronger evidence from reliable sources.";
    const hasStrongClaimSignal = /\b(always|never|guarantee|proven|cure|100%|\d+%)\b/i.test(snippet);
    return {
      snippet,
      issue: hasStrongClaimSignal ? "Potentially over-confident or absolute claim" : "Insufficiently supported factual claim",
      reason: guidance,
      severity: hasStrongClaimSignal ? "high" : "medium",
    };
  });
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [article, setArticle] = useState<ArticleWithCategory | null>(null);
  const [guestArticleLimitReached, setGuestArticleLimitReached] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [comment, setComment] = useState("");
  const [showAISummary, setShowAISummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<ArticleSummaryResult | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [credibilityAnalysis, setCredibilityAnalysis] = useState<Awaited<ReturnType<typeof getCredibilityAnalysis>>>(null);
  const [relatedArticles, setRelatedArticles] = useState<ArticleWithCategory[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    // stop state updates if component unmounts while requests are running
    let cancelled = false;
    setRelatedArticles([]);
    (async () => {
      try {
        // load the article first so we can render core content asap
        const art = await getArticleById(id);
        if (cancelled) return;
        if (!art) {
          setArticle(null);
          return;
        }

        setArticle(art as ArticleWithCategory);

        if (!cancelled) {
          await tryRecordPremiumArticleRead(art.id, art.status);
        }

        try {
          const related = await getRelatedArticles({
            excludeArticleId: art.id,
            categoryId: art.category_id,
            articleTags: art.tags ?? [],
            limit: 6,
          });
          if (!cancelled) setRelatedArticles(related);
        } catch {
          if (!cancelled) setRelatedArticles([]);
        }

        // run extra data updates, but do not fail the whole page if one fails
        try {
          await incrementArticleViews(id);
          if (!cancelled) {
            setArticle((prev) =>
              prev ? { ...prev, views: (prev.views ?? 0) + 1 } : prev
            );
          }
        } catch {
          // ignore view count errors
        }

        if (user) {
          try {
            const ok = await isBookmarked(user.id, id);
            if (!cancelled) setBookmarked(ok);
          } catch {
            // ignore bookmark state errors
          }
        }

        try {
          const [cred, cmts] = await Promise.all([
            getCredibilityAnalysis(id).catch(() => null),
            getComments(id),
          ]);
          if (!cancelled) {
            setCredibilityAnalysis(cred);
            setComments(cmts);
          }
        } catch {
          if (!cancelled) {
            setCredibilityAnalysis(null);
            setComments([]);
          }
        }
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  useEffect(() => {
    setShowAISummary(false);
    setAiSummary(null);
    setAiSummaryError(null);
    setAiSummaryLoading(false);
  }, [id]);

  useEffect(() => {
    if (!showAISummary || !article?.content?.trim()) return;
    if (aiSummary) return;
    let cancelled = false;
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    fetchArticleSummary({
      articleId: article.id,
      title: article.title ?? undefined,
      content: article.content ?? "",
    })
      .then((r) => {
        if (!cancelled) setAiSummary(r);
      })
      .catch((e) => {
        if (!cancelled) setAiSummaryError(e instanceof Error ? e.message : "Could not load summary.");
      })
      .finally(() => {
        if (!cancelled) setAiSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAISummary, article?.id, article?.content, article?.title, aiSummary]);

  useEffect(() => {
    if (user || !article || article.status !== "published") {
      setGuestArticleLimitReached(false);
      return;
    }

    try {
      const key = "guest_viewed_article_ids";
      const raw = window.localStorage.getItem(key);
      const viewed = raw ? (JSON.parse(raw) as string[]) : [];

      if (viewed.includes(article.id)) {
        setGuestArticleLimitReached(false);
        return;
      }

      if (viewed.length >= 3) {
        setGuestArticleLimitReached(true);
        return;
      }

      const updated = [...viewed, article.id];
      window.localStorage.setItem(key, JSON.stringify(updated));
      setGuestArticleLimitReached(false);
    } catch {
      setGuestArticleLimitReached(false);
    }
  }, [user?.id, article?.id, article?.status]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !comment.trim()) return;
    // post comment, then refresh list from db so counts/order stay accurate
    setCommentSubmitting(true);
    try {
      await addComment(id, user.id, comment.trim());
      setComment("");
      const cmts = await getComments(id);
      setComments(cmts);
    } catch {
      // keep form state
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user || user.role !== "premium" || !id) return;
    // simple toggle flow: remove if saved, add if not
    try {
      if (bookmarked) {
        await removeBookmark(user.id, id);
        setBookmarked(false);
      } else {
        await addBookmark(user.id, id);
        setBookmarked(true);
      }
    } catch {
      // ignore
    }
  };

  const handleReport = async () => {
    if (!user || !id || reportSent || reportSubmitting) return;
    // require a reason so moderators know why it was flagged
    const reason = reportReason.trim();
    if (!reason) {
      setReportError("Please provide a reason before flagging.");
      return;
    }
    setReportSubmitting(true);
    setReportError(null);
    try {
      const { reportArticle } = await import("../../lib/api/articles");
      await reportArticle(id, user.id, reason);
      setReportSent(true);
      setShowFlagConfirm(false);
      setReportReason("");
    } catch (err) {
      setReportError((err as Error)?.message ?? "Could not submit your report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleDeleteOwnComment = async (commentId: string) => {
    if (!user || deletingCommentId || !id) return;
    setDeletingCommentId(commentId);
    try {
      // delete in db first, then reload comments to reflect final server state
      await deleteComment(commentId);
      const refreshed = await getComments(id);
      setComments(refreshed);
    } catch (err) {
      alert((err as Error)?.message ?? "Could not delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleReportComment = async (commentId: string, commentAuthorId: string) => {
    if (!user || reportingCommentId) return;
    if (commentAuthorId === user.id) return;

    const reasonInput = window.prompt("Why are you flagging this comment?");
    const reason = reasonInput?.trim() ?? "";
    if (!reason) return;

    setReportingCommentId(commentId);
    try {
      await reportComment(commentId, user.id, reason);
      alert("Report submitted. Admins will review this comment.");
    } catch (err) {
      alert((err as Error)?.message ?? "Could not flag this comment.");
    } finally {
      setReportingCommentId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading article…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2">Article not found</h1>
        <Link to="/" className="text-red-600 hover:underline">Back to home</Link>
      </div>
    );
  }

  if (guestArticleLimitReached) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-3">Free limit reached</h1>
        <p className="text-muted-foreground mb-6">
          Guests can view up to 3 articles. Sign in or create an account to continue reading.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/login" className="px-5 py-2 border rounded-lg hover:bg-gray-50">
            Sign In
          </Link>
          <Link to="/signup" className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  // Non-published articles are hidden from regular readers.
  // Exceptions: admins and authors can view their own pending/rejected articles.
  const canViewUnpublished =
    user?.role === "admin" ||
    ((article.status === "pending" || article.status === "rejected") && user?.id === article.author_id);
  if (article.status !== "published" && !canViewUnpublished) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2">Article not available</h1>
        <p className="text-muted-foreground mb-4">
          This article is currently unavailable.
        </p>
        <Link to="/" className="text-red-600 hover:underline">Back to home</Link>
      </div>
    );
  }

  const categoryName = (article as ArticleWithCategory).category?.name ?? "Uncategorized";
  const categorySlug = (article as ArticleWithCategory).category?.slug ?? "all";
  // Use AI score by default; only treat DB credibility_score as expert score after expert verification.
  const aiScore = credibilityAnalysis?.score ?? null;
  const expertScore = article.is_verified ? article.credibility_score ?? null : null;
  const primaryScore =
    aiScore != null
      ? aiScore
      : expertScore != null
        ? expertScore
        : article.credibility_score != null
          ? article.credibility_score
          : null;

  const getCredibilityLevel = (score: number) => {
    if (score >= 80) return { level: "High", color: "green", bgColor: "bg-green-50", textColor: "text-green-800", borderColor: "border-green-200" };
    if (score >= 60) return { level: "Moderate", color: "yellow", bgColor: "bg-yellow-50", textColor: "text-yellow-800", borderColor: "border-yellow-200" };
    return { level: "Low", color: "red", bgColor: "bg-red-50", textColor: "text-red-800", borderColor: "border-red-200" };
  };

  const credibilityInfo = primaryScore != null ? getCredibilityLevel(primaryScore) : null;
  const showWarning = primaryScore != null && primaryScore < 60;
  const hasDbAnalysis = credibilityAnalysis != null;

  const factors = hasDbAnalysis
    ? {
        sourceQuality: credibilityAnalysis.source_quality ?? 0,
        factualAccuracy: credibilityAnalysis.factual_accuracy ?? 0,
        expertReview: credibilityAnalysis.expert_review_score,
        citations: credibilityAnalysis.citations_score ?? 0,
        authorCredibility: credibilityAnalysis.author_credibility_score,
      }
    : null;

  const strengths = hasDbAnalysis ? asStringArray(credibilityAnalysis.strengths) : [];
  const concerns = hasDbAnalysis ? asStringArray(credibilityAnalysis.concerns) : [];
  const warnings = hasDbAnalysis ? asStringArray(credibilityAnalysis.warnings) : [];
  const rejectionReasonSummary =
    article.status === "rejected"
      ? article.rejection_reason?.trim() ||
        "This article was rejected because parts of the content could not be sufficiently verified with reliable evidence."
      : null;
  const rejectionFindings =
    article.status === "rejected"
      ? buildSampleRejectionFindings(article.content ?? "", concerns, warnings)
      : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {showWarning && primaryScore != null && (
          <div className="mb-6 border-2 border-red-300 rounded-lg p-4 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Low Credibility Warning</h3>
                <p className="text-sm text-red-800">
                  This article has a credibility score below 60%. Please verify claims from multiple reliable sources.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link to={`/category/${categorySlug}`} className="text-sm font-semibold text-red-600 uppercase hover:underline">
              {categoryName}
            </Link>
            {article.is_verified && (
              <div className="flex items-center gap-1 text-blue-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Expert verified</span>
              </div>
            )}
          </div>

          <h1 className="text-4xl font-serif mb-4">{article.title}</h1>

          {credibilityInfo && primaryScore != null && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${credibilityInfo.borderColor} ${credibilityInfo.bgColor} mb-4`}>
              <Info className={`w-5 h-5 text-${credibilityInfo.color}-600`} />
              <div>
                <p className={`text-sm font-semibold ${credibilityInfo.textColor}`}>
                  Credibility Score: {primaryScore}% – {credibilityInfo.level}
                </p>
                <p className="text-xs text-muted-foreground">
                  {article.is_verified && expertScore != null
                    ? "Score from expert review."
                    : hasDbAnalysis
                      ? "Automated fact-check (editor): claims, news evidence, and LLM assessment saved to this article."
                      : ""}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-300 rounded-full" />
                <div>
                  <p className="font-semibold">{article.author_display_name ?? "Unknown"}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{article.published_at ? new Date(article.published_at).toLocaleDateString() : ""}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimeAgo(article.published_at ?? article.created_at)}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{article.views ?? 0} views</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {user?.role === "premium" && (
                <>
                  <button
                    type="button"
                    onClick={handleBookmarkToggle}
                    className={`p-2 border rounded-lg hover:bg-gray-50 ${bookmarked ? "bg-red-50 text-red-600" : ""}`}
                    title={bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    <Bookmark className={`w-5 h-5 ${bookmarked ? "fill-current" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      article &&
                      downloadOfflineArticleFile(
                        {
                          title: article.title,
                          author_display_name: article.author_display_name,
                          published_at: article.published_at,
                          excerpt: article.excerpt,
                          content: article.content,
                          image_url: article.image_url,
                          siteName: "FYI News",
                        },
                        article.title
                      )
                    }
                    className="p-2 border rounded-lg hover:bg-gray-50"
                    title="Download article as HTML for offline reading"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="p-2 border rounded-lg hover:bg-gray-50"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    {showShareMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg p-2 z-10">
                        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded">
                          <Facebook className="w-4 h-4" /> Facebook
                        </a>
                        <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(article.title)}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded">
                          <Twitter className="w-4 h-4" /> Twitter
                        </a>
                        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded">
                          <Linkedin className="w-4 h-4" /> LinkedIn
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
              {user && (user.role === "free" || user.role === "premium") && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !reportSent && setShowFlagConfirm(true)}
                    disabled={reportSent}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    title={reportSent ? "Report submitted" : "Report article"}
                  >
                    <Flag className="w-5 h-5" />
                  </button>
                  {showFlagConfirm && !reportSent && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg p-3 z-20">
                      <p className="text-sm mb-3">
                        Why are you flagging this article?
                      </p>
                      <textarea
                        value={reportReason}
                        onChange={(e) => {
                          setReportReason(e.target.value);
                          if (reportError) setReportError(null);
                        }}
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 mb-2"
                        rows={3}
                        maxLength={300}
                        placeholder="Tell us what is misleading, harmful, or inappropriate."
                        required
                      />
                      <p className="text-[11px] text-muted-foreground mb-2">
                        {reportReason.trim().length}/300
                      </p>
                      {reportError && (
                        <p className="text-xs text-red-600 mb-2">{reportError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                          onClick={() => {
                            setShowFlagConfirm(false);
                            setReportReason("");
                            setReportError(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={reportSubmitting || reportReason.trim().length === 0}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          onClick={handleReport}
                        >
                          {reportSubmitting ? "Submitting..." : "Submit report"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {user?.role === "premium" && (
          <div className="mb-6 border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Summary</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAISummary(!showAISummary)}
                className="text-sm text-purple-600 hover:underline"
              >
                {showAISummary ? "Hide" : "Show"}
              </button>
            </div>
            {showAISummary && (
              <div className="text-sm space-y-2">
                {aiSummaryLoading && (
                  <p className="text-muted-foreground">Generating summary…</p>
                )}
                {aiSummaryError && <p className="text-red-700">{aiSummaryError}</p>}
                {!aiSummaryLoading && aiSummary && (
                  <>
                    <p className="text-foreground leading-relaxed">{aiSummary.summary}</p>
                    {aiSummary.persisted === false && aiSummary.persistHint && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        {aiSummary.persistHint}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {aiSummary.cached && "Saved summary (shared for all readers; no new AI call). "}
                      {aiSummary.source === "openai" && "Generated with AI"}
                      {aiSummary.source === "huggingface" && "Generated with Hugging Face"}
                      {aiSummary.source === "extract" && "Auto preview (no AI keys configured or API unavailable)"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {article.image_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img src={article.image_url} alt={article.title} className="w-full" />
          </div>
        )}

        {article.status === "rejected" && (
          <div className="mb-8 border-2 border-red-200 rounded-lg overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <h3 className="font-semibold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-700" />
                AI Rejection Analysis (Sample)
              </h3>
              <p className="text-sm text-red-800 mt-1">
                This sample explains why the article may have been rejected and highlights content that likely triggered low-credibility checks.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 border border-red-200 bg-red-50 rounded">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">Rejection reason:</span> {rejectionReasonSummary}
                </p>
              </div>
              {rejectionFindings.map((finding, index) => (
                <div
                  key={index}
                  className={`rounded border p-4 ${finding.severity === "high" ? "border-red-300 bg-red-50" : "border-yellow-300 bg-yellow-50"}`}
                >
                  <p className="text-xs uppercase tracking-wide font-semibold mb-2">
                    Highlight {index + 1} • {finding.severity === "high" ? "High Risk" : "Medium Risk"}
                  </p>
                  <blockquote className="text-sm italic border-l-4 border-current pl-3 mb-2">
                    "{finding.snippet}"
                  </blockquote>
                  <p className="text-sm">
                    <span className="font-semibold">Issue:</span> {finding.issue}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Why flagged:</span> {finding.reason}
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Tip: Add citations, attribute expert statements, and avoid absolute wording unless you can provide high-quality evidence.
              </p>
            </div>
          </div>
        )}

        <div
          className="prose prose-lg max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: article.content || "" }}
        />

        {(article.author_display_name || article.author_bio) && (
          <div className="border-t border-b py-6 mb-12">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-gray-300 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">{article.author_display_name ?? "Author"}</p>
                {article.author_bio && <p className="text-sm text-muted-foreground">{article.author_bio}</p>}
              </div>
            </div>
          </div>
        )}

        {expertScore != null && !hasDbAnalysis && (
          <p className="text-sm text-muted-foreground mb-4">
            Run <span className="font-medium">Fact check draft</span> while editing this article to save automated credibility factors to the database.
          </p>
        )}

        {factors && (
          <div className="mb-6 border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b px-6 py-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Credibility Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Derived from the fact-check pipeline (news evidence + claim checks). Threshold: &lt;60% = Warning, 60–79% = Moderate, ≥80% = High.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Credibility Factors:</h4>
                {(
                  [
                    ["Source Quality", factors.sourceQuality],
                    ["Factual Accuracy", factors.factualAccuracy],
                    ["Expert Review", factors.expertReview],
                    ["Citations", factors.citations],
                    ["Author Credibility", factors.authorCredibility],
                  ] as const
                )
                  .filter((entry): entry is [string, number] => typeof entry[1] === "number")
                  .map(([label, value]) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{value}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {strengths.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-green-700 mb-2">✓ Strengths:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {strengths.map((s, i) => (
                      <li key={i} className="text-green-800">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {concerns.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-yellow-700 mb-2">⚠ Considerations:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {concerns.map((c, i) => (
                      <li key={i} className="text-yellow-800">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-red-700 mb-2">Warnings:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-red-800">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-4 mt-2 border-t text-xs text-muted-foreground">
                <span className="font-semibold">How it works:</span>{" "}
                Scores are produced when an author runs <span className="font-medium">Fact check draft</span> in the editor:
                claims are checked against retrieved news evidence and an LLM assessment; results are stored here for readers.
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            Comments ({comments.length})
          </h2>

          {user ? (
            <form onSubmit={handleCommentSubmit} className="mb-8">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                rows={4}
                placeholder="Share your thoughts..."
                required
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={commentSubmitting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {commentSubmitting ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-8 p-6 border rounded-lg bg-gray-50 text-center">
              <p className="mb-4">Please sign in to comment.</p>
              <Link to="/login" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block">
                Sign In
              </Link>
            </div>
          )}

          <div className="space-y-6">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-4">
                <UserAvatar avatar={c.user?.avatar ?? undefined} name={c.user?.name ?? undefined} size="md" className="flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                    <p className="font-semibold">{c.user?.name ?? "User"}</p>
                    <span className="text-sm text-muted-foreground">{formatTimeAgo(c.created_at)}</span>
                    </div>
                    {user && (
                      <div className="flex items-center gap-3">
                        {c.user_id !== user.id && (
                          <button
                            type="button"
                            onClick={() => handleReportComment(c.id, c.user_id)}
                            disabled={reportingCommentId === c.id}
                            className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 disabled:opacity-50"
                            title="Flag this comment"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            {reportingCommentId === c.id ? "Flagging..." : "Flag"}
                          </button>
                        )}
                        {c.user_id === user.id && (
                          <button
                            type="button"
                            onClick={() => {
                              // quick safety check before permanent delete
                              const confirmed = window.confirm(
                                "Delete this comment? This action cannot be undone."
                              );
                              if (!confirmed) return;
                              handleDeleteOwnComment(c.id);
                            }}
                            disabled={deletingCommentId === c.id}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="Delete your comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingCommentId === c.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm mb-2">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {relatedArticles.length > 0 && (
          <RelatedRecommendationsGrid articles={relatedArticles} />
        )}
      </div>
    </div>
  );
}
