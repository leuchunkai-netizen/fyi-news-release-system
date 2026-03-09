import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Eye, Star } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getExpertPendingArticles, submitExpertReview } from "../../lib/api/articles";

interface PendingArticle {
  id: string;
  title: string;
  excerpt: string | null;
  author_display_name: string | null;
  created_at: string;
  submitted_at: string | null;
  image_url: string | null;
  category: { name: string } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ExpertDashboard() {
  const { user } = useUser();
  const [pendingArticles, setPendingArticles] = useState<PendingArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState({
    rating: 0,
    credibilityScore: 0,
    factualAccuracy: 0,
    comments: "",
    flagged: false
  });
  const [submitting, setSubmitting] = useState(false);

  const loadPending = () => {
    if (!user || user.role !== "expert") return;
    setLoading(true);
    getExpertPendingArticles()
      .then(setPendingArticles)
      .catch(() => setPendingArticles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPending();
  }, [user?.id]);

  if (!user || user.role !== "expert") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">This page is only accessible to verified experts.</p>
      </div>
    );
  }

  const handleApprove = async (articleId: string) => {
    setSubmitting(true);
    try {
      await submitExpertReview(articleId, user.id, {
        decision: "approved",
        credibilityScore: reviewData.credibilityScore,
        factualAccuracy: reviewData.factualAccuracy || null,
        rating: reviewData.rating || null,
        comments: reviewData.comments.trim() || null,
        flagged: reviewData.flagged,
      });
      setSelectedArticle(null);
      setReviewData({ rating: 0, credibilityScore: 0, factualAccuracy: 0, comments: "", flagged: false });
      loadPending();
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
    setSubmitting(true);
    try {
      await submitExpertReview(articleId, user.id, {
        decision: "rejected",
        credibilityScore: reviewData.credibilityScore,
        factualAccuracy: reviewData.factualAccuracy || null,
        rating: reviewData.rating || null,
        comments: reviewData.comments.trim(),
        flagged: reviewData.flagged,
      });
      setSelectedArticle(null);
      setReviewData({ rating: 0, credibilityScore: 0, factualAccuracy: 0, comments: "", flagged: false });
      loadPending();
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
            Review submitted articles and verify their content accuracy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Pending Reviews</p>
            <p className="text-3xl font-bold">{loading ? "—" : pendingArticles.length}</p>
          </div>
        </div>

        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Pending Article Reviews</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : pendingArticles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No pending articles to review.</div>
          ) : (
            <div className="divide-y">
              {pendingArticles.map((article) => (
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
                          <h3 className="text-xl font-semibold mb-2">{article.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {article.category?.name ?? "Uncategorized"}
                            </span>
                            <span>By {article.author_display_name ?? "Unknown"}</span>
                            <span>• Submitted {formatDate(article.submitted_at ?? article.created_at)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{article.excerpt ?? ""}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(selectedArticle === article.id ? null : article.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          {selectedArticle === article.id ? "Hide Review Form" : "Review Article"}
                        </button>
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
    </div>
  );
}
