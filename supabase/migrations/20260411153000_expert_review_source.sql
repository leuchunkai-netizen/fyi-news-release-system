-- Expert dashboard review: optional citation + verify-claim-source outcome (same shape as comments).
ALTER TABLE public.expert_reviews
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS source_credibility text,
  ADD COLUMN IF NOT EXISTS source_ai_verdict text,
  ADD COLUMN IF NOT EXISTS source_check_reason text;

COMMENT ON COLUMN public.expert_reviews.source_url IS 'Citation URL verified before upsert (ExpertDashboard)';
COMMENT ON COLUMN public.expert_reviews.source_ai_verdict IS 'SUPPORT | CONTRADICT | UNRELATED from verify-claim-source';
