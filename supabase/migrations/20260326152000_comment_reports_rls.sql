-- Allow authenticated users to report comments and admins to review those reports.

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can report comments" ON public.comment_reports;
CREATE POLICY "Authenticated can report comments"
  ON public.comment_reports FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.comments c
      WHERE c.id = comment_id
        AND c.user_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all comment reports" ON public.comment_reports;
CREATE POLICY "Admins can view all comment reports"
  ON public.comment_reports FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update comment reports" ON public.comment_reports;
CREATE POLICY "Admins can update comment reports"
  ON public.comment_reports FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.update_comment_report_status_admin(
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
    RAISE EXCEPTION 'Only admins can update comment reports';
  END IF;

  IF p_status NOT IN ('pending', 'reviewed') THEN
    RAISE EXCEPTION 'Invalid report status: %', p_status;
  END IF;

  UPDATE public.comment_reports
  SET status = p_status
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment report not found: %', p_report_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_comment_report_status_admin(uuid, text) TO authenticated;
