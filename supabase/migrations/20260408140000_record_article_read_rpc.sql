-- Reliable recording from the browser: uses auth.uid() inside Postgres (no client user_id mismatch, no upsert+RLS quirks).
CREATE OR REPLACE FUNCTION public.record_article_read(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r varchar(20);
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO r FROM public.users WHERE id = uid;
  IF r IS DISTINCT FROM 'premium' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.articles
    WHERE id = p_article_id AND status = 'published'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.article_read_history (user_id, article_id, viewed_at)
  VALUES (uid, p_article_id, now())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET viewed_at = EXCLUDED.viewed_at;
END;
$$;

COMMENT ON FUNCTION public.record_article_read(uuid) IS 'Premium reading history: call from client after opening a published article';

GRANT EXECUTE ON FUNCTION public.record_article_read(uuid) TO authenticated;
