import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { ArticleCard } from "../components/ArticleCard";
import { getCategories, getPublishedArticles } from "@/lib/api";
import { previewTextFromArticle } from "@/lib/articlePreview";
import type { ArticleWithCategory } from "@/lib/api/articles";
import type { CategoryRow } from "@/lib/types/database";
import { useParams } from "react-router";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1622223145461-271074da3e20?w=1080";

function formatTimeAgoPrecise(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago`;
  }
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function mapArticleToCard(a: ArticleWithCategory) {
  return {
    id: a.id,
    imageUrl: a.image_url || DEFAULT_IMAGE,
    category: (a.category as { name?: string } | null)?.name ?? "Uncategorized",
    title: a.title,
    excerpt: previewTextFromArticle(a.excerpt, a.content),
    author: a.author_display_name ?? "Staff",
    time: formatTimeAgoPrecise(a.published_at ?? a.created_at),
    views: a.views ?? 0,
    commentsCount: a.commentsCount ?? 0,
    tags: a.tags ?? [],
    credibilityScore: a.credibility_score ?? undefined,
    isVerified: a.is_verified,
    hasAiCredibility: a.hasCredibilityAnalysis === true,
  };
}

export function SearchPage() {
  const { tag: routeTag } = useParams<{ tag?: string }>();
  const activeTag = routeTag ? decodeURIComponent(routeTag).trim().toLowerCase() : "";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [results, setResults] = useState<ReturnType<typeof mapArticleToCard>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const list = await getPublishedArticles({
        categorySlug: selectedCategory === "all" ? undefined : selectedCategory,
        tag: activeTag || undefined,
        q: searchQuery.trim() || undefined,
        limit: 50,
      });
      setResults(list.map(mapArticleToCard));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, activeTag]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    runSearch();
  }, [selectedCategory, activeTag]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">
          {activeTag ? `Tag: #${activeTag}` : "Search Articles"}
        </h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTag
                  ? `Search within #${activeTag} posts...`
                  : "Search for articles, topics, or authors..."
              }
              className="w-full pl-12 pr-4 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">FILTER BY CATEGORY</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full ${
                selectedCategory === "all" ? "bg-red-600 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === cat.slug ? "bg-red-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          {loading ? (
            <p className="text-sm text-muted-foreground mb-6">Loading...</p>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((article) => (
              <ArticleCard key={article.id} {...article} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
