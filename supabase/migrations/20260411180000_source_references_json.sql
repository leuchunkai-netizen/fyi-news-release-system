-- Multiple verified sources per expert comment / expert review (JSON array of verify-claim-source rows).
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS source_references jsonb;

COMMENT ON COLUMN public.comments.source_references IS 'Optional array of {url,sourceTitle,sourceCredibility,aiVerdict,reason}; legacy source_* = first item';

ALTER TABLE public.expert_reviews
  ADD COLUMN IF NOT EXISTS source_references jsonb;

COMMENT ON COLUMN public.expert_reviews.source_references IS 'Optional array of verified sources; legacy source_* = first item';
