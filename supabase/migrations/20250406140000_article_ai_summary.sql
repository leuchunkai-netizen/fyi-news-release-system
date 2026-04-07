-- Cached AI reader summary (one generation per content version; shared across all viewers).
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_summary_source text,
  ADD COLUMN IF NOT EXISTS ai_summary_content_hash text;

COMMENT ON COLUMN public.articles.ai_summary IS 'Server-generated reader summary; invalidated when title/body hash changes';
COMMENT ON COLUMN public.articles.ai_summary_source IS 'Which backend path produced ai_summary';
COMMENT ON COLUMN public.articles.ai_summary_content_hash IS 'sha256 hex of normalized title+body when summary was stored';
