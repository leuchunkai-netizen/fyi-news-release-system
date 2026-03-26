import { useCallback, useState, useEffect } from "react";
import { FeaturedStory } from "../components/FeaturedStory";
import { ArticleCard } from "../components/ArticleCard";
import { Sidebar } from "../components/Sidebar";
import { useUser } from "../context/UserContext";
import { useGuestLanding } from "../context/GuestLandingContext";
import { useTestimonials } from "../context/TestimonialsContext";
import { getPublishedArticles, getTrendingArticles } from "@/lib/api";
import type { ArticleWithCategory, TrendingArticleItem } from "@/lib/api/articles";
import { Link, useParams } from "react-router";
import { Star, ArrowRight, Check } from "lucide-react";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1622223145461-271074da3e20?w=1080";

const INTEREST_CATEGORY_SLUGS: Record<string, string> = {
  "World News": "world",
  Politics: "politics",
  Business: "business",
  Technology: "technology",
  Sports: "sports",
  Science: "science",
  Health: "health",
  Culture: "culture",
  Entertainment: "entertainment",
  Environment: "environment",
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "Latest",
  world: "World",
  politics: "Politics",
  business: "Business",
  technology: "Technology",
  sports: "Sports",
  science: "Science",
  health: "Health",
  culture: "Culture",
  entertainment: "Entertainment",
  environment: "Environment",
};

function toCategorySlug(label: string) {
  return (
    INTEREST_CATEGORY_SLUGS[label] ?? label.toLowerCase().replace(/\s+/g, "-")
  );
}

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
    excerpt: a.excerpt ?? "",
    author: a.author_display_name ?? "Staff",
    time: formatTimeAgoPrecise(a.published_at ?? a.created_at),
    views: a.views ?? 0,
    commentsCount: a.commentsCount ?? 0,
    credibilityScore: a.credibility_score ?? undefined,
    isVerified: a.is_verified,
  };
}

function getYouTubeEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Already an embed URL
  if (trimmed.includes("youtube.com/embed/")) return trimmed;

  // If it's a plain ID (11 chars typical), convert it.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}`;
  }

  // Try parsing as URL (watch/share/embed/shorts/youtu.be)
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }

    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;

      const parts = url.pathname.split("/").filter(Boolean);
      // /shorts/<id> or /embed/<id>
      if (parts[0] === "shorts" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
      if (parts[0] === "embed" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }
  } catch {
    // Not a valid URL; fall through to best-effort behavior.
  }

  // Best-effort fallback
  return trimmed;
}

export function HomePage() {
  const { category } = useParams<{ category?: string }>();
  const activeCategorySlug = category ?? "all";

  const { user } = useUser();
  const { introSlides, videoSection } = useGuestLanding();
  const { approvedTestimonials } = useTestimonials();

  const [dbArticles, setDbArticles] = useState<ReturnType<typeof mapArticleToCard>[]>([]);
  const [forYouSourceArticles, setForYouSourceArticles] = useState<ReturnType<typeof mapArticleToCard>[]>([]);
  const [trendingArticles, setTrendingArticles] = useState<
    Array<TrendingArticleItem & { rank: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDbError(null);
    getPublishedArticles({ limit: 10, categorySlug: activeCategorySlug })
      .then((list) => {
        if (!cancelled) setDbArticles(list.map(mapArticleToCard));
      })
      .catch((err) => {
        if (!cancelled) setDbError(err?.message ?? "Could not load articles from database.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeCategorySlug]);

  useEffect(() => {
    let cancelled = false;

    if (!user || !user.interests || user.interests.length === 0) {
      setForYouSourceArticles([]);
      return () => {
        cancelled = true;
      };
    }

    getPublishedArticles({ limit: 50, categorySlug: "all" })
      .then((list) => {
        if (!cancelled) setForYouSourceArticles(list.map(mapArticleToCard));
      })
      .catch(() => {
        if (!cancelled) setForYouSourceArticles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.interests]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setTrendingArticles([]);
      return () => {
        cancelled = true;
      };
    }

    getTrendingArticles(5)
      .then((rows) => {
        if (cancelled) return;
        setTrendingArticles(
          rows.map((item, index) => ({
            ...item,
            rank: index + 1,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setTrendingArticles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === "undefined") return;

    const element = document.getElementById(sectionId);
    if (!element) return;

    const header = document.querySelector("header");
    const headerHeight =
      header instanceof HTMLElement ? header.offsetHeight : 0;

    const headerOffset = headerHeight + 16; // extra breathing room

    const target =
      element.getBoundingClientRect().top + window.scrollY - headerOffset;

    const start = window.scrollY;
    const distance = target - start;
    const duration = 800; // ms – slower than native smooth scroll
    let startTime: number | null = null;

    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutQuad(progress);

      window.scrollTo(0, start + distance * eased);

      if (elapsed < duration) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, []);

  const forYouArticles =
    user && user.interests && user.interests.length
      ? forYouSourceArticles
          .filter((article) => {
            const articleSlug = toCategorySlug(article.category);
            return user.interests!.some(
              (interest) => toCategorySlug(interest) === articleSlug
            );
          })
          .slice(0, 4)
      : [];

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        {/* Guest side navigation for quick section jumps (desktop) */}
        {!user && (
          <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-24">
              <div className="bg-white shadow-sm rounded-2xl px-3 py-4 space-y-3 border border-gray-100 max-h-[70vh] overflow-auto">
              <div className="px-1">
                <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Explore this page
                </span>
              </div>
              <nav className="flex flex-col gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => scrollToSection("featured-section")}
                  className="w-full text-left px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Intro &amp; Features
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("video-section")}
                  className="w-full text-left px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("latest-section")}
                  className="w-full text-left px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Latest News
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("subscription-section")}
                  className="w-full text-left px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("testimonials-section")}
                  className="w-full text-left px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                >
                  Testimonials
                </button>
              </nav>
              </div>
            </div>
          </aside>
        )}

        {/* Main content column */}
        <div className="flex-1 space-y-8">
          {/* For You - interests section for all registered users (top, below header) */}
          {user && activeCategorySlug === "all" && forYouArticles.length > 0 && (
            <section
              id="for-you-section"
              className="mb-6 border rounded-lg px-4 py-5 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">For You</h2>
                <p className="text-xs text-muted-foreground">
                  Articles based on your interests
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {forYouArticles.map((article) => (
                  <ArticleCard key={article.id} {...article} variant="compact" />
                ))}
              </div>
            </section>
          )}

          {/* Mobile guest navigation bar for quick section jumps */}
          {!user && (
            <div className="lg:hidden bg-white/80 backdrop-blur border rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Explore this page:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("featured-section")}
                  className="px-3 py-1.5 text-sm border rounded-full hover:bg-gray-50"
                >
                  Intro &amp; Features
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("video-section")}
                  className="px-3 py-1.5 text-sm border rounded-full hover:bg-gray-50"
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("latest-section")}
                  className="px-3 py-1.5 text-sm border rounded-full hover:bg-gray-50"
                >
                  Latest News
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("subscription-section")}
                  className="px-3 py-1.5 text-sm border rounded-full hover:bg-gray-50"
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("testimonials-section")}
                  className="px-3 py-1.5 text-sm border rounded-full hover:bg-gray-50"
                >
                  Testimonials
                </button>
              </div>
            </div>
          )}

          {/* Featured / Intro section: guests only */}
          {!user && (
            <div id="featured-section" className="mb-4">
              <FeaturedStory
                stories={introSlides.map((s) => ({
                  imageUrl: s.imageUrl || "",
                  category: s.category,
                  title: s.title,
                  excerpt: s.excerpt,
                  author: "",
                  time: "",
                }))}
                hideByline
              />
            </div>
          )}

          {/* Video section - guests only, admin-editable */}
          {!user && (
            <div id="video-section" className="mb-12">
              <div className="border rounded-lg p-6 bg-gray-50">
                <h2 className="text-2xl font-semibold mb-2">
                  {videoSection.title || "Welcome"}
                </h2>
                {videoSection.description && (
                  <p className="text-muted-foreground mb-4">
                    {videoSection.description}
                  </p>
                )}
                {videoSection.videoUrl ? (
                  <div className="aspect-video max-w-3xl rounded-lg overflow-hidden bg-black">
                    <iframe
                      title="Platform introduction"
                      src={getYouTubeEmbedUrl(videoSection.videoUrl)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video max-w-3xl rounded-lg bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-500 text-sm">
                      Video URL not set. Admin can add one in Dashboard → Guest
                      Landing.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div
            id="latest-section"
            className={`grid grid-cols-1 gap-8 ${
              user ? "lg:grid-cols-3" : ""
            }`}
          >
            {/* Articles Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">
                  {activeCategorySlug === "all"
                    ? "Latest News"
                    : `${CATEGORY_LABELS[activeCategorySlug] ?? "Category"} News`}
                </h2>
                {/* View All - Only show for registered users */}
                {user && (
                  <Link
                    to="/search"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-200 rounded-full bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {loading ? (
                  <p className="col-span-2 text-muted-foreground py-8">
                    Loading latest news…
                  </p>
                ) : dbError ? (
                  <p className="col-span-2 text-amber-600 py-4">
                    {dbError} Check your .env (VITE_SUPABASE_URL,
                    VITE_SUPABASE_ANON_KEY) and that the migration was run.
                  </p>
                ) : dbArticles.length > 0 ? (
                  (user ? dbArticles : dbArticles.slice(0, 2)).map((article) => (
                    <ArticleCard key={article.id} {...article} />
                  ))
                ) : (
                  <p className="col-span-2 text-muted-foreground py-8">
                    {activeCategorySlug === "all"
                      ? "No published articles yet. Publish articles from Admin or Upload to see them here."
                      : "No published articles in this category yet."}
                  </p>
                )}
              </div>

              {/* Subscription teaser - for Guest Users, under Latest News */}
              {!user && (
                <div id="subscription-section" className="border-t pt-8 mb-12">
                  <h2 className="text-2xl font-semibold mb-4">
                    Choose your plan
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Get unlimited access to quality journalism.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Free */}
                    <div className="border rounded-lg p-6 bg-white">
                      <h3 className="text-xl font-semibold mb-2">Free</h3>
                      <div className="mb-4">
                        <span className="text-3xl font-bold">$0</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">View news articles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Search for articles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Comment on articles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Upload your own articles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Report articles</span>
                        </li>
                      </ul>
                      <Link
                        to="/signup"
                        className="block w-full px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700"
                      >
                        Get Started
                      </Link>
                    </div>

                    {/* Premium monthly */}
                    <div className="border-2 border-red-600 rounded-lg p-6 bg-white relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-600 text-white text-xs rounded-full">
                        Most Popular
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Premium</h3>
                      <div className="mb-4">
                        <span className="text-3xl font-bold">$9.99</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm font-semibold">All Free features, plus:</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">AI-generated article summaries</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Bookmark articles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Apply for expert verification</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Ad-free experience</span>
                        </li>
                      </ul>
                      <Link
                        to="/signup"
                        className="block w-full px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700"
                      >
                        Sign up to get Premium
                      </Link>
                    </div>

                    {/* Premium yearly */}
                    <div className="border rounded-lg p-6 bg-white relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-white text-xs rounded-full">
                        Best Value
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Premium (Yearly)</h3>
                      <div className="mb-2">
                        <span className="text-3xl font-bold">$4.99</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Billed yearly · <span className="font-medium text-gray-900">$59.88</span>/year
                      </p>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm font-semibold">All Premium features, plus:</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Save 50% vs monthly billing</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">One payment per year</span>
                        </li>
                      </ul>
                      <Link
                        to="/signup"
                        className="block w-full px-4 py-2 bg-yellow-500 text-white text-center rounded-lg hover:bg-yellow-600"
                      >
                        Sign up to get Premium Yearly
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Testimonials Section - for Guest Users */}
              {!user && (
                <div id="testimonials-section" className="border-t pt-8 mb-12">
                  <h2 className="text-2xl font-semibold mb-6">
                    What Our Readers Say
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {approvedTestimonials.map((t) => (
                        <div key={t.id} className="border p-6 rounded-lg">
                          <div
                            className="flex items-center gap-1 mb-3"
                            aria-label={`Rated ${t.rating} out of 5`}
                          >
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                className={`w-4 h-4 ${
                                  idx < t.rating
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-sm mb-4 italic">"{t.message}"</p>
                          <p className="font-semibold">- {t.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.role}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - hide for guest users */}
            {user && (
              <div className="lg:col-span-1">
                <Sidebar trendingArticles={trendingArticles} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}