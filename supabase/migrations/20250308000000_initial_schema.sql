-- FYI News Release System - Initial Schema (PostgreSQL for Supabase)
-- Run this in Supabase SQL Editor or via Supabase CLI: supabase db push

-- Enable UUID extension (Supabase usually has it; safe to run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS & AUTH (profiles sync with auth.users is optional; we use public.users)
-- =============================================================================

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'free' CHECK (role IN ('guest','free','premium','expert','admin')),
  avatar varchar(500),
  gender varchar(50),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'From UserContext: id, name, email, role, avatar, gender, interests';
COMMENT ON COLUMN public.users.role IS 'guest | free | premium | expert | admin';
COMMENT ON COLUMN public.users.status IS 'active | suspended';

-- =============================================================================
-- CATEGORIES
-- =============================================================================

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'AdminDashboard categories; SearchPage filter by category';

-- =============================================================================
-- USER INTERESTS (after users and categories)
-- =============================================================================

CREATE TABLE public.user_interests (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

-- =============================================================================
-- ARTICLES & CREDIBILITY
-- =============================================================================

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title varchar(500) NOT NULL,
  excerpt text,
  content text,
  image_url varchar(500),
  author_display_name varchar(255),
  author_bio text,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected','flagged')),
  credibility_score int CHECK (credibility_score IS NULL OR (credibility_score >= 0 AND credibility_score <= 100)),
  is_verified boolean NOT NULL DEFAULT false,
  expert_reviewer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  submitted_at timestamptz,
  rejection_reason text,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.articles IS 'From ArticleCard, ArticleDetailPage, MyArticlesPage; expert verification from ExpertDashboard';
COMMENT ON COLUMN public.articles.author_id IS 'User who submitted the article';
COMMENT ON COLUMN public.articles.content IS 'HTML content';
COMMENT ON COLUMN public.articles.credibility_score IS '0-100, set after expert review';
COMMENT ON COLUMN public.articles.status IS 'draft | pending | published | rejected | flagged';

CREATE TABLE public.article_credibility_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL UNIQUE REFERENCES public.articles(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score >= 0 AND score <= 100),
  source_quality int CHECK (source_quality IS NULL OR (source_quality >= 0 AND source_quality <= 100)),
  factual_accuracy int CHECK (factual_accuracy IS NULL OR (factual_accuracy >= 0 AND factual_accuracy <= 100)),
  expert_review_score int CHECK (expert_review_score IS NULL OR (expert_review_score >= 0 AND expert_review_score <= 100)),
  citations_score int CHECK (citations_score IS NULL OR (citations_score >= 0 AND citations_score <= 100)),
  author_credibility_score int CHECK (author_credibility_score IS NULL OR (author_credibility_score >= 0 AND author_credibility_score <= 100)),
  strengths jsonb,
  concerns jsonb,
  warnings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.article_credibility_analysis IS 'From ArticleDetailPage credibilityAnalysis; AI-analyzed factors (AI part skipped per requirements)';
COMMENT ON COLUMN public.article_credibility_analysis.score IS '0-100';

CREATE TABLE public.expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credibility_score int NOT NULL CHECK (credibility_score >= 0 AND credibility_score <= 100),
  factual_accuracy int CHECK (factual_accuracy IS NULL OR (factual_accuracy >= 0 AND factual_accuracy <= 100)),
  rating int CHECK (rating IS NULL OR (rating >= 0 AND rating <= 100)),
  comments text,
  flagged boolean NOT NULL DEFAULT false,
  decision varchar(20) NOT NULL CHECK (decision IN ('approved','rejected')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, expert_id)
);

COMMENT ON TABLE public.expert_reviews IS 'ExpertDashboard: expert approves/rejects with score and comments';
COMMENT ON COLUMN public.expert_reviews.rating IS 'Expert rating';

-- =============================================================================
-- COMMENTS & ENGAGEMENT
-- =============================================================================

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes int NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','flagged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.comments IS 'From ArticleDetailPage comments; AdminDashboard comment moderation';

CREATE TABLE public.bookmarks (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

COMMENT ON TABLE public.bookmarks IS 'Premium users only; BookmarksPage';

CREATE TABLE public.article_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.article_reports IS 'Free/premium users can report articles (Flag on ArticleDetailPage)';

-- =============================================================================
-- TESTIMONIALS
-- =============================================================================

CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name varchar(255) NOT NULL,
  role varchar(255) NOT NULL,
  message text NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.testimonials IS 'From TestimonialsContext; shown on guest landing when approved';
COMMENT ON COLUMN public.testimonials.user_id IS 'Optional; may be guest submission';

-- =============================================================================
-- GUEST LANDING (ADMIN-EDITABLE)
-- =============================================================================

CREATE TABLE public.guest_landing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_title varchar(255) NOT NULL DEFAULT 'Welcome to our platform',
  video_description text,
  video_url varchar(500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guest_landing_settings IS 'From GuestLandingContext videoSection; single row or key-value';

CREATE TABLE public.intro_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL,
  category varchar(100) NOT NULL,
  title varchar(500) NOT NULL,
  excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intro_slides IS 'From GuestLandingContext introSlides; admin-editable for guest home';
COMMENT ON COLUMN public.intro_slides.category IS 'e.g. Features';

-- =============================================================================
-- EXPERT APPLICATIONS (ADMIN)
-- =============================================================================

CREATE TABLE public.expert_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expertise varchar(255) NOT NULL,
  credentials text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.expert_applications IS 'AdminDashboard expert applications; approve grants expert role';

-- =============================================================================
-- FEATURED ARTICLES (OPTIONAL)
-- =============================================================================

CREATE TABLE public.featured_articles (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  sort_order int NOT NULL,
  featured_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.featured_articles IS 'Optional: editorial featured stories on home';

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Enable and add policies as needed
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_credibility_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_landing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_articles ENABLE ROW LEVEL SECURITY;

-- Public read for categories (everyone can list/filter)
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT USING (true);

-- Public read for published articles
CREATE POLICY "Published articles are viewable by everyone"
  ON public.articles FOR SELECT
  USING (status = 'published');

-- Users can read/update their own profile; allow insert for new sign-ups (same id as auth.uid())
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Allow anon/authenticated to read guest landing (for guest home page)
CREATE POLICY "Guest landing settings viewable by everyone"
  ON public.guest_landing_settings FOR SELECT USING (true);
CREATE POLICY "Intro slides viewable by everyone"
  ON public.intro_slides FOR SELECT USING (true);

-- Approved testimonials viewable by everyone
CREATE POLICY "Approved testimonials viewable by everyone"
  ON public.testimonials FOR SELECT
  USING (status = 'approved');

-- Authors can manage their own articles (insert/update when author_id = auth.uid())
CREATE POLICY "Users can insert articles"
  ON public.articles FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own articles"
  ON public.articles FOR UPDATE
  USING (auth.uid() = author_id);

-- Comments: anyone authenticated can insert; can read for published articles (simplified: allow read all)
CREATE POLICY "Comments viewable by everyone"
  ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Bookmarks: user can only see/edit their own
CREATE POLICY "Users can view own bookmarks"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Admin / expert policies: use Supabase service role or add role-based policies
-- For prototype: allow authenticated to read more (e.g. draft for own); admins via service role
CREATE POLICY "Users can view own draft/pending articles"
  ON public.articles FOR SELECT
  USING (auth.uid() = author_id OR status = 'published');

-- Allow inserting testimonials (guest or authenticated)
CREATE POLICY "Anyone can submit testimonials"
  ON public.testimonials FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own testimonials"
  ON public.testimonials FOR SELECT
  USING (auth.uid() = user_id OR status = 'approved');

-- Expert applications: user can insert own; read own
CREATE POLICY "Users can submit expert application"
  ON public.expert_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own expert application"
  ON public.expert_applications FOR SELECT USING (auth.uid() = user_id);

-- Article reports: authenticated can insert
CREATE POLICY "Authenticated can report articles"
  ON public.article_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credibility analysis: read when article is published (via article_id join in app or policy with subquery)
CREATE POLICY "Credibility analysis viewable for published articles"
  ON public.article_credibility_analysis FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_credibility_analysis.article_id AND a.status = 'published')
  );

-- Expert reviews: experts/admins manage via service role or add role check (optional)
-- For prototype we leave expert_reviews and admin-only tables with strict RLS; use service role in backend for admin actions.
CREATE POLICY "Expert reviews viewable for published articles"
  ON public.expert_reviews FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.articles a WHERE a.id = expert_reviews.article_id AND a.status = 'published')
  );

-- Featured articles: public read
CREATE POLICY "Featured articles viewable by everyone"
  ON public.featured_articles FOR SELECT USING (true);

-- =============================================================================
-- SEED (optional): default categories and one guest_landing_settings row
-- =============================================================================

INSERT INTO public.categories (name, slug, description) VALUES
  ('Technology', 'technology', 'Tech and innovation'),
  ('Business', 'business', 'Business and economy'),
  ('Breaking News', 'breaking-news', 'Breaking and top stories'),
  ('Health', 'health', 'Health and wellness'),
  ('Science', 'science', 'Science and research')
ON CONFLICT (slug) DO NOTHING;

-- Insert default guest landing row (run once; table may be empty)
INSERT INTO public.guest_landing_settings (video_title, video_description, video_url)
SELECT 'Welcome to our platform', 'Watch a short introduction to our features and how to get the most out of the site.', ''
WHERE NOT EXISTS (SELECT 1 FROM public.guest_landing_settings LIMIT 1);
