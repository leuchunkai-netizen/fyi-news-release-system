import { Link } from "react-router";
import type { ArticleWithCategory } from "@/lib/api/articles";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1622223145461-271074da3e20?w=1080";

interface RelatedRecommendationsGridProps {
  articles: ArticleWithCategory[];
  /** Section heading (default: Also read) */
  title?: string;
}

/**
 * Modular two-column “recommended” strip: thumbnail left, category + headline right,
 * light gray tiles (similar to common news-site patterns).
 */
export function RelatedRecommendationsGrid({
  articles,
  title = "Also read",
}: RelatedRecommendationsGridProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-10 mb-12" aria-labelledby="related-recommendations-heading">
      <h2
        id="related-recommendations-heading"
        className="mb-4 text-lg font-bold uppercase tracking-wide text-red-600"
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {articles.map((a) => {
          const cat = (a.category as { name?: string } | null)?.name ?? "News";
          const label = `${cat.toUpperCase()} · NEWS`;

          return (
            <Link
              key={a.id}
              to={`/article/${a.id}`}
              className="group flex flex-row overflow-hidden rounded-lg bg-[#f2f2f2] transition-colors hover:bg-gray-200"
            >
              <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden bg-gray-300 sm:h-32 sm:w-32">
                <img
                  src={a.image_url || FALLBACK_IMAGE}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2 sm:px-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 sm:text-xs">
                  {label}
                </p>
                <p className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 sm:text-base">
                  {a.title}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
