-- PostgREST / supabase-js expect RPC responses to be valid JSON. RETURNS void yields an empty
-- body and triggers "Cannot coerce the result to a single JSON object" on the client.
-- These functions are invoked via supabase.rpc from the app.

DROP FUNCTION IF EXISTS public.update_article_status_admin(uuid, text);
CREATE FUNCTION public.update_article_status_admin(p_article_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can update article status';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('published', 'rejected', 'flagged') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.articles
  SET status = p_status::text, updated_at = now()
  WHERE id = p_article_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article not found';
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_article_status_admin(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_article_status_admin(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.update_article_report_status_admin(uuid, text);
CREATE FUNCTION public.update_article_report_status_admin(
  p_report_id uuid,
  p_status text DEFAULT 'reviewed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can update article reports';
  END IF;

  IF p_status NOT IN ('pending', 'reviewed') THEN
    RAISE EXCEPTION 'Invalid report status: %', p_status;
  END IF;

  UPDATE public.article_reports
  SET status = p_status
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found: %', p_report_id;
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_article_report_status_admin(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.record_article_read(uuid);
CREATE FUNCTION public.record_article_read(p_article_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r varchar(20);
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO r FROM public.users WHERE id = uid;
  IF r IS DISTINCT FROM 'premium' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.articles
    WHERE id = p_article_id AND status = 'published'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.article_read_history (user_id, article_id, viewed_at)
  VALUES (uid, p_article_id, now())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET viewed_at = EXCLUDED.viewed_at;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.record_article_read(uuid) IS 'Premium reading history: call from client after opening a published article; returns true when a row was written.';

GRANT EXECUTE ON FUNCTION public.record_article_read(uuid) TO authenticated;
