import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Clock, Bookmark, Share2, Sparkles, Flag, CheckCircle, ThumbsUp, MessageCircle, Facebook, Twitter, Linkedin, AlertTriangle, Info } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getArticleById, incrementArticleViews, getCredibilityAnalysis } from "../../lib/api/articles";
import { getComments, addComment } from "../../lib/api/comments";
import { addBookmark, removeBookmark, isBookmarked } from "../../lib/api/bookmarks";
import type { ArticleWithCategory } from "../../lib/api/articles";
import type { CommentWithAuthor } from "../../lib/api/comments";

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString();
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [article, setArticle] = useState<ArticleWithCategory | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [comment, setComment] = useState("");
  const [showAISummary, setShowAISummary] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [credibilityAnalysis, setCredibilityAnalysis] = useState<Awaited<ReturnType<typeof getCredibilityAnalysis>>>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const art = await getArticleById(id);
        if (cancelled) return;
        if (art) {
          setArticle(art as ArticleWithCategory);
          await incrementArticleViews(id);
          if (user) {
            const ok = await isBookmarked(user.id, id);
            if (!cancelled) setBookmarked(ok);
          }
          const [cred, cmts] = await Promise.all([
            getCredibilityAnalysis(id).catch(() => null),
            getComments(id),
          ]);
          if (!cancelled) {
            setCredibilityAnalysis(cred);
            setComments(cmts);
          }
        } else {
          setArticle(null);
        }
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !comment.trim()) return;
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
    if (!user || !id || reportSent) return;
    try {
      const { reportArticle } = await import("../../lib/api/articles");
      await reportArticle(id, user.id, "User reported");
      setReportSent(true);
    } catch {
      // ignore
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

  const categoryName = (article as ArticleWithCategory).category?.name ?? "News";
  const categorySlug = (article as ArticleWithCategory).category?.slug ?? "all";
  const credibilityScore = article.credibility_score ?? 0;

  const getCredibilityLevel = (score: number) => {
    if (score >= 80) return { level: "High", color: "green", bgColor: "bg-green-50", textColor: "text-green-800", borderColor: "border-green-200" };
    if (score >= 60) return { level: "Moderate", color: "yellow", bgColor: "bg-yellow-50", textColor: "text-yellow-800", borderColor: "border-yellow-200" };
    return { level: "Low", color: "red", bgColor: "bg-red-50", textColor: "text-red-800", borderColor: "border-red-200" };
  };

  const credibilityInfo = getCredibilityLevel(credibilityAnalysis?.score ?? credibilityScore);
  const showWarning = (credibilityAnalysis?.score ?? credibilityScore) < 60;

  const factors = credibilityAnalysis
    ? {
        sourceQuality: credibilityAnalysis.source_quality ?? 0,
        factualAccuracy: credibilityAnalysis.factual_accuracy ?? 0,
        expertReview: credibilityAnalysis.expert_review_score ?? 0,
        citations: credibilityAnalysis.citations_score ?? 0,
        authorCredibility: credibilityAnalysis.author_credibility_score ?? 0,
      }
    : null;
  const strengths = (credibilityAnalysis?.strengths as string[] | undefined) ?? [];
  const concerns = (credibilityAnalysis?.concerns as string[] | undefined) ?? [];
  const warnings = (credibilityAnalysis?.warnings as string[] | undefined) ?? [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {showWarning && (
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

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${credibilityInfo.borderColor} ${credibilityInfo.bgColor} mb-4`}>
            <Info className={`w-5 h-5 text-${credibilityInfo.color}-600`} />
            <div>
              <p className={`text-sm font-semibold ${credibilityInfo.textColor}`}>
                Credibility Score: {credibilityAnalysis?.score ?? credibilityScore}% – {credibilityInfo.level}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on sources, expert review, and factual accuracy
              </p>
            </div>
          </div>

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
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={reportSent}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  title={reportSent ? "Report submitted" : "Report article"}
                >
                  <Flag className="w-5 h-5" />
                </button>
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
              <p className="text-sm">{article.excerpt || "No summary available."}</p>
            )}
          </div>
        )}

        {article.image_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img src={article.image_url} alt={article.title} className="w-full" />
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

        {(credibilityAnalysis || factors) && (
          <div className="mb-6 border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b px-6 py-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Credibility Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Based on source quality, factual accuracy, expert review, citations, and author credibility.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {factors && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Factors:</h4>
                  {[
                    ["Source quality", factors.sourceQuality],
                    ["Factual accuracy", factors.factualAccuracy],
                    ["Expert review", factors.expertReview],
                    ["Citations", factors.citations],
                    ["Author credibility", factors.authorCredibility],
                  ].map(([label, value]) => (
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
              )}
              {strengths.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-green-700 mb-2">Strengths:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {strengths.map((s, i) => (
                      <li key={i} className="text-green-800">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {concerns.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-yellow-700 mb-2">Considerations:</h4>
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
                <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{c.user?.name ?? "User"}</p>
                    <span className="text-sm text-muted-foreground">{formatTimeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm mb-2">{c.content}</p>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ThumbsUp className="w-4 h-4" />
                      {c.likes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
