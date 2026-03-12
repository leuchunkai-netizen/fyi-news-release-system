-- Enable admin visibility and moderation actions for flagged article reports.
-- Without these policies, Admin Dashboard "Flagged Content" cannot load/resolve reports.

DROP POLICY IF EXISTS "Admins can view all article reports" ON public.article_reports;
CREATE POLICY "Admins can view all article reports"
  ON public.article_reports FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update article reports" ON public.article_reports;
CREATE POLICY "Admins can update article reports"
  ON public.article_reports FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
