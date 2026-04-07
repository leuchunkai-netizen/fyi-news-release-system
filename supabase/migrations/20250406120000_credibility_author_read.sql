-- Allow article authors to read credibility analysis for their own articles (any status),
-- so drafts show saved fact-check data before publish. Published articles remain readable to all.

CREATE POLICY "Authors can read credibility analysis for own articles"
  ON public.article_credibility_analysis
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_credibility_analysis.article_id
        AND a.author_id = auth.uid()
    )
  );
