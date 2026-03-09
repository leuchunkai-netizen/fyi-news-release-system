-- =============================================================================
-- SEED DATA – Run this in Supabase SQL Editor after migrations
-- Use this to add categories, guest landing content, and sample data.
-- =============================================================================

-- Categories used by the signup "Select Interests" step and by seed articles (migration also inserts technology, business, etc.)
INSERT INTO public.categories (name, slug, description) VALUES
  ('Technology', 'technology', 'Technology and innovation'),
  ('Business', 'business', 'Business and economy'),
  ('Breaking News', 'breaking-news', 'Breaking and urgent news'),
  ('Health', 'health', 'Health and medicine'),
  ('Science', 'science', 'Science and research'),
  ('World News', 'world-news', 'World and international news'),
  ('Politics', 'politics', 'Politics and policy'),
  ('Sports', 'sports', 'Sports and athletics'),
  ('Culture', 'culture', 'Culture and arts'),
  ('Entertainment', 'entertainment', 'Entertainment and media'),
  ('Environment', 'environment', 'Environment and climate')
ON CONFLICT (slug) DO NOTHING;

-- Guest landing: ensure one row
INSERT INTO public.guest_landing_settings (video_title, video_description, video_url)
SELECT 'Welcome to our platform', 'Watch a short introduction to our features.', 'https://www.youtube.com/embed/dQw4w9WgXcQ'
WHERE NOT EXISTS (SELECT 1 FROM public.guest_landing_settings LIMIT 1);

-- Intro slides for guest home (admin-editable). Re-running seed: clear first to avoid duplicates.
DELETE FROM public.intro_slides WHERE sort_order BETWEEN 1 AND 4 AND category = 'Features';
INSERT INTO public.intro_slides (sort_order, category, title, excerpt) VALUES
  (1, 'Features', 'Curated News', 'Stay informed with trusted, up-to-date stories from verified sources.'),
  (2, 'Features', 'Expert Verification', 'Articles can be reviewed and verified by experts for extra credibility.'),
  (3, 'Features', 'AI Summaries', 'Get quick AI-powered summaries so you can catch up on the news in less time.'),
  (4, 'Features', 'Bookmarks & Personalization', 'Save articles and tailor your feed to the topics you care about most.');

-- =============================================================================
-- MOCK USERS (for demo content – do not use in production auth)
-- =============================================================================
-- DEMO LOGIN CREDENTIALS (create these in Supabase Dashboard → Authentication → Users):
--
--   Email: sarah.j@example.com       Password: DemoPassword123!
--   Email: michael.chen@example.com  Password: DemoPassword123!
--   Email: emma.w@example.com       Password: DemoPassword123!
--
-- To link a seed user to a real Auth user (so you can log in as them):
-- 1. Run migration 20250308120000_users_id_update_cascade.sql first (so id updates cascade to articles, comments, etc.).
-- 2. In Supabase Dashboard go to Authentication → Users and open the user. Copy the "User UID" (the UUID shown there).
-- 3. In SQL Editor run (paste that UUID in place of YOUR_AUTH_UUID_HERE for each user):
--
--   UPDATE public.users SET id = 'YOUR_AUTH_UUID_HERE'::uuid WHERE email = 'sarah.j@example.com';
--   UPDATE public.users SET id = 'YOUR_AUTH_UUID_HERE'::uuid WHERE email = 'michael.chen@example.com';
--   UPDATE public.users SET id = 'YOUR_AUTH_UUID_HERE'::uuid WHERE email = 'emma.w@example.com';
--
-- Use the UUID that is *inside* the Auth user row (Authentication → Users → click user → copy UID), not a placeholder.
-- =============================================================================
INSERT INTO public.users (id, name, email, role, status, created_at, updated_at) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'Sarah Johnson', 'sarah.j@example.com', 'free', 'active', now() - interval '30 days', now()),
  ('a0000001-0000-4000-8000-000000000002', 'Michael Chen', 'michael.chen@example.com', 'premium', 'active', now() - interval '20 days', now()),
  ('a0000001-0000-4000-8000-000000000003', 'Emma Williams', 'emma.w@example.com', 'expert', 'active', now() - interval '60 days', now())
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- MOCK ARTICLES (requires categories to exist – run after initial migration)
-- =============================================================================
INSERT INTO public.articles (
  id, category_id, author_id, title, excerpt, content, image_url, author_display_name,
  status, credibility_score, is_verified, published_at, views, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM public.categories WHERE slug = 'technology' LIMIT 1),
  'a0000001-0000-4000-8000-000000000001',
  'New AI Breakthrough Promises to Revolutionize Healthcare Diagnostics',
  'Scientists have developed an artificial intelligence system that can detect diseases with 99% accuracy.',
  '<p>Full article content here. AI is transforming healthcare.</p>',
  'https://images.unsplash.com/photo-1767797852518-d3c8bc6088eb?w=1080',
  'Sarah Johnson',
  'published',
  95,
  true,
  now() - interval '3 hours',
  120,
  now() - interval '1 day',
  now()
WHERE EXISTS (SELECT 1 FROM public.categories WHERE slug = 'technology' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.articles WHERE title = 'New AI Breakthrough Promises to Revolutionize Healthcare Diagnostics' LIMIT 1);

INSERT INTO public.articles (
  id, category_id, author_id, title, excerpt, content, image_url, author_display_name,
  status, credibility_score, is_verified, published_at, views, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM public.categories WHERE slug = 'business' LIMIT 1),
  'a0000001-0000-4000-8000-000000000002',
  'Global Markets Rally as Economic Recovery Gains Momentum',
  'Stock markets worldwide posted strong gains amid positive economic indicators.',
  '<p>Markets are showing strong recovery signals.</p>',
  'https://images.unsplash.com/photo-1606419866333-ced28837d700?w=1080',
  'Michael Chen',
  'published',
  92,
  true,
  now() - interval '4 hours',
  89,
  now() - interval '1 day',
  now()
WHERE EXISTS (SELECT 1 FROM public.categories WHERE slug = 'business' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.articles WHERE title = 'Global Markets Rally as Economic Recovery Gains Momentum' LIMIT 1);

INSERT INTO public.articles (
  id, category_id, author_id, title, excerpt, content, image_url, author_display_name,
  status, credibility_score, is_verified, published_at, views, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM public.categories WHERE slug = 'breaking-news' LIMIT 1),
  'a0000001-0000-4000-8000-000000000003',
  'Major Climate Summit Reaches Historic Agreement on Carbon Emissions',
  'World leaders from over 190 countries have reached a groundbreaking agreement to reduce global carbon emissions by 50% by 2030.',
  '<p>Historic climate agreement reached.</p>',
  'https://images.unsplash.com/photo-1622223145461-271074da3e20?w=1080',
  'Emma Williams',
  'published',
  88,
  true,
  now() - interval '2 hours',
  256,
  now() - interval '2 days',
  now()
WHERE EXISTS (SELECT 1 FROM public.categories WHERE slug = 'breaking-news' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.articles WHERE title = 'Major Climate Summit Reaches Historic Agreement on Carbon Emissions' LIMIT 1);

INSERT INTO public.articles (
  id, category_id, author_id, title, excerpt, content, image_url, author_display_name,
  status, credibility_score, is_verified, published_at, views, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM public.categories WHERE slug = 'health' LIMIT 1),
  'a0000001-0000-4000-8000-000000000001',
  'FDA Approves Revolutionary AI Diagnostic System for Clinical Use',
  'The FDA has granted approval for MedScan AI, marking the first time an AI diagnostic system has received full regulatory clearance.',
  '<p>FDA approval opens new era in medical AI.</p>',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1080',
  'Sarah Johnson',
  'published',
  94,
  true,
  now() - interval '1 hour',
  312,
  now() - interval '3 days',
  now()
WHERE EXISTS (SELECT 1 FROM public.categories WHERE slug = 'health' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.articles WHERE title = 'FDA Approves Revolutionary AI Diagnostic System for Clinical Use' LIMIT 1);

INSERT INTO public.articles (
  id, category_id, author_id, title, excerpt, content, image_url, author_display_name,
  status, credibility_score, is_verified, published_at, views, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM public.categories WHERE slug = 'science' LIMIT 1),
  'a0000001-0000-4000-8000-000000000003',
  'Scientists Make Breakthrough in Renewable Energy Storage Technology',
  'A new battery technology could double the storage capacity of renewable energy systems.',
  '<p>Breakthrough in energy storage.</p>',
  NULL,
  'Emma Williams',
  'published',
  90,
  false,
  now() - interval '5 hours',
  67,
  now() - interval '4 days',
  now()
WHERE EXISTS (SELECT 1 FROM public.categories WHERE slug = 'science' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.articles WHERE title = 'Scientists Make Breakthrough in Renewable Energy Storage Technology' LIMIT 1);

-- =============================================================================
-- ARTICLE CREDIBILITY ANALYSIS (optional – for article detail page)
-- =============================================================================
INSERT INTO public.article_credibility_analysis (article_id, score, source_quality, factual_accuracy, expert_review_score, citations_score, author_credibility_score, strengths, concerns, warnings)
SELECT a.id, 92, 90, 94, 95, 88, 90,
  '["Multiple sources", "Expert reviewed"]'::jsonb,
  '["Recent development"]'::jsonb,
  '[]'::jsonb
FROM public.articles a
WHERE a.title = 'New AI Breakthrough Promises to Revolutionize Healthcare Diagnostics'
LIMIT 1
ON CONFLICT (article_id) DO NOTHING;

-- =============================================================================
-- TESTIMONIALS (approved – shown on guest landing)
-- =============================================================================
INSERT INTO public.testimonials (user_id, name, role, message, rating, status, created_at) VALUES
  (NULL, 'John Smith', 'Premium Member', 'This platform has become my go-to source for reliable news. The expert verification system gives me confidence in what I''m reading.', 5, 'approved', now() - interval '10 days'),
  (NULL, 'Maria Garcia', 'Premium Member', 'I love the AI summaries feature. It saves me time while keeping me informed on all the important stories.', 5, 'approved', now() - interval '7 days'),
  (NULL, 'David Kim', 'Free Member', 'Clean design and easy to navigate. Looking forward to upgrading for bookmarks.', 4, 'approved', now() - interval '3 days');

-- =============================================================================
-- COMMENTS (on first two articles)
-- =============================================================================
INSERT INTO public.comments (article_id, user_id, content, likes, status, created_at, updated_at)
SELECT a.id, 'a0000001-0000-4000-8000-000000000002', 'Great article, very informative!', 5, 'active', now() - interval '2 hours', now()
FROM public.articles a WHERE a.title = 'New AI Breakthrough Promises to Revolutionize Healthcare Diagnostics' LIMIT 1;

INSERT INTO public.comments (article_id, user_id, content, likes, status, created_at, updated_at)
SELECT a.id, 'a0000001-0000-4000-8000-000000000001', 'Markets have been very volatile. Good summary.', 2, 'active', now() - interval '1 hour', now()
FROM public.articles a WHERE a.title = 'Global Markets Rally as Economic Recovery Gains Momentum' LIMIT 1;

-- =============================================================================
-- EXPERT APPLICATIONS (pending – for admin dashboard)
-- =============================================================================
INSERT INTO public.expert_applications (user_id, expertise, credentials, status, applied_at) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'Medicine & Healthcare', 'MD, PhD in Neuroscience, 15 years clinical experience', 'pending', now() - interval '5 days'),
  ('a0000001-0000-4000-8000-000000000002', 'Technology & Engineering', 'PhD in Computer Science, 20+ publications in AI research', 'pending', now() - interval '3 days');

-- =============================================================================
-- FEATURED ARTICLES (top 3 published by published_at for home carousel)
-- =============================================================================
INSERT INTO public.featured_articles (article_id, sort_order, featured_at)
SELECT id, row_number() OVER (), now()
FROM (
  SELECT id FROM public.articles WHERE status = 'published' ORDER BY published_at DESC NULLS LAST LIMIT 3
) t
ON CONFLICT (article_id) DO NOTHING;

-- =============================================================================
-- USERS: Normal sign-ups go through the app (Supabase Auth + public.users via signUp in auth.ts).
-- The mock users above are for demo content only (e.g. article authors). For real admin testing,
-- create a user via the app and then set role = 'admin' in public.users in SQL Editor.
-- =============================================================================
