import { TrendingUp } from "lucide-react";
import { Link } from "react-router";

interface TrendingItem {
  id: string;
  rank: number;
  title: string;
  category: string;
  views: number;
  comments: number;
  publishedAt: string | null;
}

interface LatestItem {
  id: string;
  title: string;
  category: string;
  publishedAt: string | null;
}

interface SidebarProps {
  trendingArticles: TrendingItem[];
  latestArticles: LatestItem[];
}

export function Sidebar({ trendingArticles, latestArticles }: SidebarProps) {
  const formatPublishedTime = (iso: string | null) => {
    if (!iso) return "";
    const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return "Just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <aside className="space-y-8">
      {/* Trending */}
      <div className="border-2 border-gray-300 bg-white p-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-lg font-bold">TRENDING NOW</h2>
        </div>
        <div className="space-y-4">
          {trendingArticles.map((article) => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="flex gap-3 group border-b pb-3 last:border-b-0"
            >
              <span className="text-2xl font-bold text-gray-300">{article.rank}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold uppercase border border-black px-1">
                  {article.category}
                </span>
                <h3 className="font-bold text-sm line-clamp-2 group-hover:underline mt-1">
                  {article.title}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {article.views} views • {article.comments} comments
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Latest News */}
      <div className="border-2 border-gray-300 bg-white p-6">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b-2 border-black">
          LATEST NEWS
        </h2>
        <div className="space-y-3">
          {latestArticles.slice(0, 5).map((article) => (
            <Link key={`latest-${article.id}`} to={`/article/${article.id}`} className="group block">
              <span className="inline-block text-[10px] font-bold uppercase border border-black px-1 py-0.5 mb-1">
                {article.category}
              </span>
              <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline">
                {article.title}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatPublishedTime(article.publishedAt)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="border-2 border-gray-300 bg-white p-6">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b-2 border-black">CATEGORIES</h2>
        <div className="space-y-2">
          {["World", "Politics", "Business", "Technology", "Sports", "Science", "Culture", "Opinion"].map((category) => (
            <Link
              key={category}
              to={`/category/${category.toLowerCase()}`}
              className="block py-2 border-b hover:font-bold transition-all"
            >
              {category}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}