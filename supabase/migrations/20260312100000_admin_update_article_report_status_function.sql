-- Admin helper to resolve/ignore article reports without relying on table-level RLS updates.
-- Mirrors the existing update_article_status_admin approach.

CREATE OR REPLACE FUNCTION public.update_article_report_status_admin(
  p_report_id uuid,
  p_status text DEFAULT 'reviewed'
)
RETURNS void
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_article_report_status_admin(uuid, text) TO authenticated;
