-- Tags for "Also read" related recommendations (same category + overlap).
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
