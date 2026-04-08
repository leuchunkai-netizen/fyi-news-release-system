import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Download } from "lucide-react";
import { useUser } from "../context/UserContext";
import { ArticleCard } from "../components/ArticleCard";
import { getCategories } from "../../lib/api/categories";
import { getReadingHistory, removeReadingHistoryEntry, type ReadHistoryItem } from "../../lib/api/readHistory";
import { downloadOfflineArticleFile } from "../../lib/downloadArticleHtml";
import { previewTextFromArticle } from "../../lib/articlePreview";
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

export function ReadingHistoryPage() {
  const { user } = useUser();
  const [items, setItems] = useState<ReadHistoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "premium") {
      setLoading(false);
      return;
    }
    (async () => {
      setLoadError(null);
      try {
        const [list, cats] = await Promise.all([
          getReadingHistory(),
          getCategories(),
        ]);
        setItems(list);
        setCategories(cats);
      } catch (e) {
        setItems([]);
        setLoadError(
          e instanceof Error ? e.message : "Could not load reading history. Apply Supabase migrations and try again."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.role]);

  const handleDownload = (row: ReadHistoryItem) => {
    const a = row.article;
    downloadOfflineArticleFile(
      {
        title: a.title,
        author_display_name: a.author_display_name,
        published_at: a.published_at,
        excerpt: a.excerpt,
        content: a.content,
        image_url: a.image_url,
        siteName: "FYI News",
      },
      a.title
    );
  };

  const handleRemove = async (articleId: string) => {
    if (!user) return;
    try {
      await removeReadingHistoryEntry(user.id, articleId);
      setItems((prev) => prev.filter((x) => x.article.id !== articleId));
    } catch {
      // ignore
    }
  };

  if (!user || user.role !== "premium") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Premium Feature</h1>
        <p className="text-muted-foreground mb-6">
          Reading history is available for Premium members.
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
        <p className="text-muted-foreground">Loading reading history…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Reading History</h1>
        <p className="text-muted-foreground mb-8">
          Articles you have opened (newest first). Use <span className="font-medium">Download HTML</span> to save a file for offline reading in your browser.
        </p>

        {loadError && (
          <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
            {loadError}
            <p className="mt-2 text-xs text-amber-800">
              In Supabase SQL Editor, run the files{" "}
              <code className="bg-amber-100 px-1 rounded">20260408120000_article_read_history.sql</code> and{" "}
              <code className="bg-amber-100 px-1 rounded">20260408140000_record_article_read_rpc.sql</code>{" "}
              (or <code className="bg-amber-100 px-1 rounded">supabase db push</code>).
            </p>
          </div>
        )}

        {!loadError && items.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <p className="text-muted-foreground mb-4">No history yet — open published articles while logged in as Premium.</p>
            <Link
              to="/"
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
            >
              Browse Articles
            </Link>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((row) => {
              const article = row.article;
              return (
                <div key={article.id} className="relative group flex flex-col">
                  <p className="text-xs text-muted-foreground mb-1 px-0.5">
                    Last read {formatTimeAgo(row.viewed_at)}
                  </p>
                  <ArticleCard
                    id={article.id}
                    imageUrl={article.image_url ?? ""}
                    category={categoryMap.get(article.category_id ?? "") ?? "Uncategorized"}
                    title={article.title}
                    excerpt={previewTextFromArticle(article.excerpt, article.content)}
                    author={article.author_display_name ?? "Unknown"}
                    time={formatTimeAgo(article.published_at ?? article.created_at)}
                    views={article.views ?? 0}
                    credibilityScore={article.credibility_score ?? undefined}
                    isVerified={article.is_verified}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(row)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border rounded-lg bg-white hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4" />
                      Download HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(article.id)}
                      className="px-3 py-2 text-sm border rounded-lg text-red-600 hover:bg-red-50"
                      title="Remove from history"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
