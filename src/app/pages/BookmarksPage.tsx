import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { ArticleCard } from "../components/ArticleCard";
import { Link } from "react-router";
import { getBookmarkedArticles, removeBookmark } from "../../lib/api/bookmarks";
import { getCategories } from "../../lib/api/categories";
import type { ArticleRow } from "../../lib/types/database";
import type { CategoryRow } from "../../lib/types/database";

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

export function BookmarksPage() {
  const { user } = useUser();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "premium") {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [list, cats] = await Promise.all([
          getBookmarkedArticles(user.id),
          getCategories(),
        ]);
        setArticles(list);
        setCategories(cats);
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.role]);

  const handleRemoveBookmark = async (articleId: string) => {
    if (!user) return;
    try {
      await removeBookmark(user.id, articleId);
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
    } catch {
      // ignore
    }
  };

  if (!user || user.role !== "premium") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Premium Feature</h1>
        <p className="text-muted-foreground mb-6">
          Bookmarks are only available for Premium members.
        </p>
        <Link
          to="/subscription"
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading bookmarks...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">My Bookmarks</h1>
        <p className="text-muted-foreground mb-8">
          Articles you have saved for later reading
        </p>

        {articles.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <p className="text-muted-foreground mb-4">You have not bookmarked any articles yet</p>
            <Link
              to="/"
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
            >
              Browse Articles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <div key={article.id} className="relative group">
                <ArticleCard
                  id={article.id}
                  imageUrl={article.image_url ?? ""}
                  category={categoryMap.get(article.category_id ?? "") ?? "News"}
                  title={article.title}
                  excerpt={article.excerpt ?? ""}
                  author={article.author_display_name ?? "Unknown"}
                  time={formatTimeAgo(article.published_at ?? article.created_at)}
                  views={article.views ?? 0}
                  credibilityScore={article.credibility_score ?? undefined}
                  isVerified={article.is_verified}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBookmark(article.id)}
                  className="absolute top-2 right-2 z-10 p-2 bg-white/90 rounded-lg shadow border hover:bg-gray-100 text-red-600"
                  title="Remove bookmark"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
