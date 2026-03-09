import { useCallback, useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { FeaturedStory } from "../components/FeaturedStory";
import { ArticleCard } from "../components/ArticleCard";
import { Sidebar } from "../components/Sidebar";
import { useUser } from "../context/UserContext";
import { useGuestLanding } from "../context/GuestLandingContext";
import { useTestimonials } from "../context/TestimonialsContext";
import { getPublishedArticles, getFeaturedArticles } from "@/lib/api";
import type { ArticleWithCategory } from "@/lib/api/articles";
import { Link } from "react-router";
import { Star } from "lucide-react";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1622223145461-271074da3e20?w=1080";

function mapArticleToCard(a: ArticleWithCategory) {
  return {
    id: a.id,
    imageUrl: a.image_url || DEFAULT_IMAGE,
    category: (a.category as { name?: string } | null)?.name ?? "Uncategorized",
    title: a.title,
    excerpt: a.excerpt ?? "",
    author: a.author_display_name ?? "Staff",
    time: a.published_at ? formatDistanceToNow(new Date(a.published_at), { addSuffix: true }) : "",
    credibilityScore: a.credibility_score ?? undefined,
    isVerified: a.is_verified,
  };
}

export function HomePage() {
  const { user } = useUser();
  const { introSlides, videoSection } = useGuestLanding();
  const { approvedTestimonials } = useTestimonials();

  const [dbArticles, setDbArticles] = useState<ReturnType<typeof mapArticleToCard>[]>([]);
  const [featuredFromDb, setFeaturedFromDb] = useState<ReturnType<typeof mapArticleToCard>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDbError(null);
    getPublishedArticles({ limit: 10 })
      .then((list) => {
        if (!cancelled) setDbArticles(list.map(mapArticleToCard));
      })
      .catch((err) => {
        if (!cancelled) setDbError(err?.message ?? "Could not load articles from database.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getFeaturedArticles(5)
      .then((rows) => {
        if (cancelled) return;
        const list = (rows as { articles: ArticleWithCategory | null }[])
          .map((r) => r.articles)
          .filter(Boolean) as ArticleWithCategory[];
        setFeaturedFromDb(list.map(mapArticleToCard));
      })
      .catch(() => { /* featured is optional; keep featuredFromDb empty */ });
    return () => { cancelled = true; };
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const trendingArticles = dbArticles.slice(0, 5).map((a, i) => ({
    rank: i + 1,
    title: a.title,
    category: a.category,
  }));

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      {/* Guest navigation bar for quick section jumps */}
      {!user && (
        <div className="sticky top-16 z-10 bg-white/80 backdrop-blur border rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Explore this page:</span>
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

      {/* User Role Demo Switcher - for wireframe demonstration */}
      {!user && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2">Demo: Quick Login (Wireframe Only)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try different user roles to see different features:
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link to="/login?demo=guest" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Continue as Guest
            </Link>
            <Link to="/login?demo=free" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Demo Free User
            </Link>
            <Link to="/login?demo=premium" className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
              Demo Premium User
            </Link>
            <Link to="/login?demo=expert" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Demo Expert User
            </Link>
            <Link to="/login?demo=admin" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              Demo Admin User
            </Link>
          </div>
        </div>
      )}

      {/* Featured / Intro section: intro slides for guests, breaking news for logged-in users */}
      <div id="featured-section" className="mb-12">
        {!user ? (
          <FeaturedStory
            stories={introSlides.map((s) => ({
              imageUrl: "",
              category: s.category,
              title: s.title,
              excerpt: s.excerpt,
              author: "",
              time: "",
            }))}
            hideByline
          />
        ) : (
          <FeaturedStory
            stories={
              featuredFromDb.length > 0
                ? featuredFromDb.map((a) => ({
                    imageUrl: a.imageUrl,
                    category: a.category,
                    title: a.title,
                    excerpt: a.excerpt,
                    author: a.author,
                    time: a.time,
                  }))
                : dbArticles.length > 0
                  ? dbArticles.slice(0, 4).map((a) => ({
                      imageUrl: a.imageUrl,
                      category: a.category,
                      title: a.title,
                      excerpt: a.excerpt,
                      author: a.author,
                      time: a.time,
                    }))
                  : []
            }
          />
        )}
      </div>

      {/* Video section - guests only, admin-editable */}
      {!user && (
        <div id="video-section" className="mb-12">
          <div className="border rounded-lg p-6 bg-gray-50">
            <h2 className="text-2xl font-semibold mb-2">{videoSection.title || "Welcome"}</h2>
            {videoSection.description && (
              <p className="text-muted-foreground mb-4">{videoSection.description}</p>
            )}
            {videoSection.videoUrl ? (
              <div className="aspect-video max-w-3xl rounded-lg overflow-hidden bg-black">
                <iframe
                  title="Platform introduction"
                  src={videoSection.videoUrl.startsWith("http") ? videoSection.videoUrl : `https://www.youtube.com/embed/${videoSection.videoUrl}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video max-w-3xl rounded-lg bg-gray-300 flex items-center justify-center">
                <span className="text-gray-500 text-sm">Video URL not set. Admin can add one in Dashboard → Guest Landing.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div
        id="latest-section"
        className={`grid grid-cols-1 gap-8 ${user ? "lg:grid-cols-3" : ""}`}
      >
        {/* Articles Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Latest News</h2>
            {/* View All - Only show for registered users */}
            {user && (
              <Link to="/search" className="text-sm text-red-600 hover:underline">
                View All
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {loading ? (
              <p className="col-span-2 text-muted-foreground py-8">Loading latest news…</p>
            ) : dbError ? (
              <p className="col-span-2 text-amber-600 py-4">
                {dbError} Check your .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) and that the migration was run.
              </p>
            ) : dbArticles.length > 0 ? (
              (user ? dbArticles : dbArticles.slice(0, 2)).map((article) => (
                <ArticleCard key={article.id} {...article} />
              ))
            ) : (
              <p className="col-span-2 text-muted-foreground py-8">No published articles yet. Publish articles from Admin or Upload to see them here.</p>
            )}
          </div>

          {/* Subscription teaser - for Guest Users, under Latest News */}
          {!user && (
            <div id="subscription-section" className="border-t pt-8 mb-12">
              <h2 className="text-2xl font-semibold mb-4">Subscribe to unlock more</h2>
              <p className="text-muted-foreground mb-6">
                Get full access to our latest stories, AI summaries, bookmarks, and more with a Premium subscription.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Free</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Continue reading the latest headlines at no cost.
                  </p>
                  <Link
                    to="/signup"
                    className="inline-block px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Continue as Free
                  </Link>
                </div>
                <div className="border-2 border-red-600 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Premium</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlock AI summaries, bookmarks, expert tools, and an ad-free reading experience.
                  </p>
                  <Link
                    to="/subscription"
                    className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    View Premium Plan
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Testimonials Section - for Guest Users */}
          {!user && (
            <div id="testimonials-section" className="border-t pt-8 mb-12">
              <h2 className="text-2xl font-semibold mb-6">What Our Readers Say</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {approvedTestimonials.map((t) => (
                    <div key={t.id} className="border p-6 rounded-lg">
                      <div className="flex items-center gap-1 mb-3" aria-label={`Rated ${t.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`w-4 h-4 ${
                              idx < t.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm mb-4 italic">"{t.message}"</p>
                      <p className="font-semibold">- {t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
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
    </main>
  );
}