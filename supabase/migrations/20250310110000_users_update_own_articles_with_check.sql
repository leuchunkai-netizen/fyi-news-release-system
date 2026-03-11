-- Fix: "new row violates RLS" when admin suspends/unsuspends articles.
-- "Users can update own articles" had WITH CHECK (auth.uid() = author_id) by default,
-- so the new row failed when admin (not author) updated. Add OR current_user_is_admin()
-- so the new row is allowed when the updater is an admin.
DROP POLICY IF EXISTS "Users can update own articles" ON public.articles;
CREATE POLICY "Users can update own articles"
  ON public.articles FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id OR public.current_user_is_admin());
