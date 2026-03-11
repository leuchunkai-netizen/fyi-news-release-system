-- Bypass RLS for admin article status updates (suspend/unsuspend) using a SECURITY DEFINER function.
-- The function checks the caller is admin, then updates the row; RLS is not applied inside the function.
CREATE OR REPLACE FUNCTION public.update_article_status_admin(p_article_id uuid, p_status text)
RETURNS void
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_article_status_admin(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_article_status_admin(uuid, text) TO authenticated;
