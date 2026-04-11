-- expert_reviews: upsert from ExpertDashboard needs UPDATE on conflict, not only INSERT.
-- Tighten INSERT so experts can only create rows for themselves.

DROP POLICY IF EXISTS "Experts can insert expert reviews" ON public.expert_reviews;

CREATE POLICY "Experts can insert own expert reviews"
  ON public.expert_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = expert_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
  );

CREATE POLICY "Experts can update own expert reviews"
  ON public.expert_reviews FOR UPDATE
  USING (auth.uid() = expert_id)
  WITH CHECK (auth.uid() = expert_id);

-- submitExpertReview upserts expert_reviews then updates articles. Published rows are not
-- "pending", so "Experts can update pending articles for review" does not apply.
-- Allow experts to update a published article only if they already have a review row for it
-- (created/updated in the same flow immediately before this UPDATE).

CREATE POLICY "Experts can update published articles they reviewed"
  ON public.articles FOR UPDATE
  USING (
    status = 'published'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
    AND EXISTS (
      SELECT 1 FROM public.expert_reviews er
      WHERE er.article_id = articles.id AND er.expert_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'expert')
    AND status IN ('published', 'rejected')
  );
