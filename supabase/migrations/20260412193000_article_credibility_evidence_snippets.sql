-- Persist news pipeline evidence (top evidence rows) for display on article AI Credibility Analysis.
ALTER TABLE public.article_credibility_analysis
  ADD COLUMN IF NOT EXISTS evidence_snippets jsonb;

COMMENT ON COLUMN public.article_credibility_analysis.evidence_snippets IS 'Array of {title, source, desc, link?} from fact-check pipeline (Evidence snippets used).';
