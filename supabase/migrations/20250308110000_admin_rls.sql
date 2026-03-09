-- RLS policies for admin role: allow users with role = 'admin' to read users, articles, comments, expert_applications.
-- Admins are identified by public.users.role = 'admin' (set in SQL or via app).

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Admins can view all articles"
  ON public.articles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Admins can view all comments"
  ON public.comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Admins can view all expert applications"
  ON public.expert_applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Allow admins to update guest_landing_settings and manage intro_slides (insert/update/delete)
CREATE POLICY "Admins can update guest landing settings"
  ON public.guest_landing_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Admins can view all intro_slides"
  ON public.intro_slides FOR SELECT USING (true);
CREATE POLICY "Admins can insert intro_slides"
  ON public.intro_slides FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Admins can update intro_slides"
  ON public.intro_slides FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "Admins can delete intro_slides"
  ON public.intro_slides FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
