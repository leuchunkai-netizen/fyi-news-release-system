import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Edit, Trash2, Eye, Clock, CheckCircle, XCircle } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getMyArticles, deleteArticle } from "../../lib/api/articles";
import type { ArticleWithCategory } from "../../lib/api/articles";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyArticlesPage() {
  const { user } = useUser();
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "pending" | "rejected">("all");
  const [articles, setArticles] = useState<ArticleWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || (user.role !== "free" && user.role !== "premium")) return;
    setLoading(true);
    getMyArticles(user.id)
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  if (!user || (user.role !== "free" && user.role !== "premium")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You need to be logged in to view your articles.</p>
      </div>
    );
  }

  const filteredArticles =
    filter === "all"
      ? articles
      : articles.filter((a) => a.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
            <CheckCircle className="w-3 h-3" />
            Published
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case "draft":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
            <Edit className="w-3 h-3" />
            Draft
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const handleDelete = async (articleId: string) => {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    try {
      await deleteArticle(articleId);
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
    } catch {
      alert("Failed to delete.");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading your articles…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">My Articles</h1>
            <p className="text-muted-foreground">
              Manage and track your submitted articles
            </p>
          </div>
          <Link
            to="/upload-article"
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Upload New Article
          </Link>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-4 py-2 ${filter === "all" ? "border-b-2 border-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            All ({articles.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("draft")}
            className={`px-4 py-2 ${filter === "draft" ? "border-b-2 border-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            Draft ({articles.filter((a) => a.status === "draft").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("published")}
            className={`px-4 py-2 ${filter === "published" ? "border-b-2 border-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            Published ({articles.filter((a) => a.status === "published").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 ${filter === "pending" ? "border-b-2 border-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            Pending ({articles.filter((a) => a.status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("rejected")}
            className={`px-4 py-2 ${filter === "rejected" ? "border-b-2 border-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            Rejected ({articles.filter((a) => a.status === "rejected").length})
          </button>
        </div>

        <div className="space-y-4">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <p className="text-muted-foreground mb-4">No articles found</p>
              <Link
                to="/upload-article"
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
              >
                Upload Your First Article
              </Link>
            </div>
          ) : (
            filteredArticles.map((article) => (
              <div key={article.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
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
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {(article as ArticleWithCategory).category?.name ?? "Uncategorized"}
                          </span>
                          {getStatusBadge(article.status)}
                          {article.status === "published" && article.credibility_score != null && (
                            <span className="text-green-600 font-semibold">
                              {article.credibility_score}% Credibility
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {article.status === "published" && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {article.views ?? 0} views
                        </div>
                        <span>Published on {formatDate(article.published_at)}</span>
                      </div>
                    )}

                    {article.status === "pending" && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Submitted on {formatDate(article.submitted_at ?? article.created_at)} • Under expert review
                      </p>
                    )}
                    {article.status === "draft" && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Saved as draft on {formatDate(article.updated_at)}
                      </p>
                    )}

                    {article.status === "rejected" && article.rejection_reason && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-700">
                          <strong>Rejection Reason:</strong> {article.rejection_reason}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {article.status === "published" && (
                        <Link
                          to={`/article/${article.id}`}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      )}
                      {article.status === "draft" && (
                        <Link
                          to={`/my-articles/${article.id}/edit`}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Continue Editing
                        </Link>
                      )}
                      {article.status === "rejected" && (
                        <Link
                          to={`/my-articles/${article.id}/edit`}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Revise & Resubmit
                        </Link>
                      )}
                      {article.status === "pending" && (
                        <Link
                          to={`/article/${article.id}`}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(article.id)}
                        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
