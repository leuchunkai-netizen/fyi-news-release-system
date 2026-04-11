-- Experts can read their own expert_reviews even when the article is not published (e.g. rejected).
CREATE POLICY "Experts can select own expert reviews"
  ON public.expert_reviews FOR SELECT
  USING (
    auth.uid() = expert_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

-- Experts can delete their own review row (app updates article first where required).
CREATE POLICY "Experts can delete own expert reviews"
  ON public.expert_reviews FOR DELETE
  USING (
    auth.uid() = expert_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

-- Experts can open articles they have reviewed (e.g. rejected) even if not public.
CREATE POLICY "Experts can view articles they reviewed"
  ON public.articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expert_reviews er
      WHERE er.article_id = articles.id AND er.expert_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

-- After approving, expert may remove verification: clear flags while keeping article published.
CREATE POLICY "Experts can withdraw own verification from published articles"
  ON public.articles FOR UPDATE
  USING (
    status = 'published'
    AND auth.uid() = expert_reviewer_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  )
  WITH CHECK (
    status = 'published'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

-- Let expert delete their rejection and return the article to the queue (review row deleted after this update).
CREATE POLICY "Experts can reopen articles they rejected"
  ON public.articles FOR UPDATE
  USING (
    status = 'rejected'
    AND EXISTS (
      SELECT 1 FROM public.expert_reviews er
      WHERE er.article_id = articles.id AND er.expert_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  )
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );
