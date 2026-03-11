-- Fix: allow admin UPDATE on articles so the *new* row passes RLS (suspend/unsuspend).
-- Use a SECURITY DEFINER function so the admin check can read public.users without being blocked by RLS.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- Allow the Supabase API (anon, authenticated) to call this function.
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- Drop and recreate the policy so WITH CHECK explicitly allows the new row when current user is admin.
DROP POLICY IF EXISTS "Admins can update articles" ON public.articles;
CREATE POLICY "Admins can update articles"
  ON public.articles FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
