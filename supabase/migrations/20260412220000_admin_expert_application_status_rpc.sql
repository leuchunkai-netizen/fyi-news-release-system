-- Approve/reject expert applications reliably: PostgREST can return success with 0 rows updated
-- when RLS blocks updates, so the app used to show success while status stayed "pending".
-- This function runs as definer (bypasses RLS) but only after an explicit admin role check on auth.uid().

CREATE OR REPLACE FUNCTION public.admin_set_expert_application_status(
  p_application_id uuid,
  p_status text,
  p_reviewed_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.expert_applications
  SET
    status = p_status,
    reviewed_at = now(),
    reviewed_by = COALESCE(p_reviewed_by, auth.uid())
  WHERE id = p_application_id
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'expert application not found';
  END IF;

  IF p_status = 'approved' THEN
    UPDATE public.users SET role = 'expert' WHERE id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_expert_application_status(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_expert_application_status(uuid, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_set_expert_application_status(uuid, text, uuid) IS
  'Admin-only: set expert_applications.status to approved/rejected and grant expert role on approve.';
