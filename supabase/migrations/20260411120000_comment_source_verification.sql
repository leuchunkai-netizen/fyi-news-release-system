-- Expert (and optional future) comments: store URL + outcome of same verify-claim-source pipeline as upload flow.
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS source_credibility text,
  ADD COLUMN IF NOT EXISTS source_ai_verdict text,
  ADD COLUMN IF NOT EXISTS source_check_reason text;

COMMENT ON COLUMN public.comments.source_url IS 'Citation URL checked server-side before insert (experts)';
COMMENT ON COLUMN public.comments.source_ai_verdict IS 'SUPPORT | CONTRADICT | UNRELATED from verify-claim-source';
