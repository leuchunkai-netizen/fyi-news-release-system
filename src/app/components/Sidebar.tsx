import { TrendingUp } from "lucide-react";

interface TrendingItem {
  rank: number;
  title: string;
  category: string;
}

interface SidebarProps {
  trendingArticles: TrendingItem[];
}

export function Sidebar({ trendingArticles }: SidebarProps) {
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
            <div key={article.rank} className="flex gap-3 group cursor-pointer border-b pb-3 last:border-b-0">
              <span className="text-2xl font-bold text-gray-300">{article.rank}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold uppercase border border-black px-1">
                  {article.category}
                </span>
                <h3 className="font-bold text-sm line-clamp-2 group-hover:underline mt-1">
                  {article.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="border-2 border-gray-300 bg-white p-6">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b-2 border-black">CATEGORIES</h2>
        <div className="space-y-2">
          {["World", "Politics", "Business", "Technology", "Sports", "Science", "Culture", "Opinion"].map((category) => (
            <a
              key={category}
              href="#"
              className="block py-2 border-b hover:font-bold transition-all"
            >
              {category}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}