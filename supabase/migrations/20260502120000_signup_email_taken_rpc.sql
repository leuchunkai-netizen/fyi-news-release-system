-- Allow signup UX to detect existing auth emails without exposing auth.users broadly.
CREATE OR REPLACE FUNCTION public.is_signup_email_taken(candidate_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm TEXT;
BEGIN
  norm := lower(trim(COALESCE(candidate_email, '')));
  IF norm = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.email IS NOT NULL
      AND lower(trim(au.email::TEXT)) = norm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_signup_email_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_signup_email_taken(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_signup_email_taken(TEXT) TO authenticated;

COMMENT ON FUNCTION public.is_signup_email_taken(TEXT) IS
  'Signup: returns true when auth.users already has this email (case-insensitive). Callable with anon role.';
