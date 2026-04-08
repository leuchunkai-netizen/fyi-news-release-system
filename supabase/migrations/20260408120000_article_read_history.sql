-- Premium: per-user last-open timestamps per article (reading history & offline downloads).
CREATE TABLE public.article_read_history (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

COMMENT ON TABLE public.article_read_history IS 'Premium Reading history; upsert on each article open';

CREATE INDEX article_read_history_user_viewed_at_idx
  ON public.article_read_history (user_id, viewed_at DESC);

ALTER TABLE public.article_read_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own read history"
  ON public.article_read_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own read history"
  ON public.article_read_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own read history"
  ON public.article_read_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own read history"
  ON public.article_read_history FOR DELETE
  USING (auth.uid() = user_id);
