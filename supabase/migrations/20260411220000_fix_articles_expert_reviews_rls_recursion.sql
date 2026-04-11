-- Fix infinite RLS recursion: policies on articles that SELECT expert_reviews caused
-- expert_reviews RLS to re-check articles → stack overflow / 500 from PostgREST.
-- This helper runs as definer and bypasses RLS on expert_reviews for the existence check only.

CREATE OR REPLACE FUNCTION public.expert_has_review_for_article(p_article_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expert_reviews er
    WHERE er.article_id = p_article_id
      AND er.expert_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.expert_has_review_for_article(uuid) IS
  'True if current user has an expert_reviews row for the article; used by articles RLS to avoid recursion.';

REVOKE ALL ON FUNCTION public.expert_has_review_for_article(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expert_has_review_for_article(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_has_review_for_article(uuid) TO service_role;

DROP POLICY IF EXISTS "Experts can view articles they reviewed" ON public.articles;
CREATE POLICY "Experts can view articles they reviewed"
  ON public.articles FOR SELECT
  USING (
    public.expert_has_review_for_article(id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

DROP POLICY IF EXISTS "Experts can reopen articles they rejected" ON public.articles;
CREATE POLICY "Experts can reopen articles they rejected"
  ON public.articles FOR UPDATE
  USING (
    status = 'rejected'
    AND public.expert_has_review_for_article(id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  )
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

DROP POLICY IF EXISTS "Experts can update published articles they reviewed" ON public.articles;
CREATE POLICY "Experts can update published articles they reviewed"
  ON public.articles FOR UPDATE
  USING (
    status = 'published'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
    AND public.expert_has_review_for_article(id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
    AND status IN ('published', 'rejected')
  );
