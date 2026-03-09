-- Allow linking seed demo users to Supabase Auth by updating public.users.id.
-- ON UPDATE CASCADE propagates the new id to articles, comments, etc.

ALTER TABLE public.user_interests
  DROP CONSTRAINT IF EXISTS user_interests_user_id_fkey,
  ADD CONSTRAINT user_interests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_author_id_fkey,
  ADD CONSTRAINT articles_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_expert_reviewer_id_fkey,
  ADD CONSTRAINT articles_expert_reviewer_id_fkey
    FOREIGN KEY (expert_reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.expert_reviews
  DROP CONSTRAINT IF EXISTS expert_reviews_expert_id_fkey,
  ADD CONSTRAINT expert_reviews_expert_id_fkey
    FOREIGN KEY (expert_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
  ADD CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.bookmarks
  DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey,
  ADD CONSTRAINT bookmarks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.article_reports
  DROP CONSTRAINT IF EXISTS article_reports_user_id_fkey,
  ADD CONSTRAINT article_reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_user_id_fkey,
  ADD CONSTRAINT testimonials_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.expert_applications
  DROP CONSTRAINT IF EXISTS expert_applications_user_id_fkey,
  ADD CONSTRAINT expert_applications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.expert_applications
  DROP CONSTRAINT IF EXISTS expert_applications_reviewed_by_fkey,
  ADD CONSTRAINT expert_applications_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;
