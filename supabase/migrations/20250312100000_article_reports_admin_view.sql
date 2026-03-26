-- Allow admins to view all article reports for moderation.
-- Admins are identified by public.users.role = 'admin'.

CREATE POLICY "Admins can view all article reports"
  ON public.article_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

