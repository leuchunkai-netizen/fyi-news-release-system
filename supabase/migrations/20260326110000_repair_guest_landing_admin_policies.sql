-- Repair/ensure admin RLS policies for guest landing tables.
-- Safe to run multiple times.

DO $$
BEGIN
  -- ---------------------------------------------------------------------------
  -- guest_landing_settings policies
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_landing_settings'
      AND policyname = 'Admins can update guest landing settings'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can update guest landing settings"
        ON public.guest_landing_settings FOR UPDATE
        USING (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  ELSE
    EXECUTE $p$
      ALTER POLICY "Admins can update guest landing settings"
        ON public.guest_landing_settings
        USING (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_landing_settings'
      AND policyname = 'Admins can insert guest landing settings'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can insert guest landing settings"
        ON public.guest_landing_settings FOR INSERT
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  END IF;

  -- ---------------------------------------------------------------------------
  -- intro_slides policies
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intro_slides'
      AND policyname = 'Admins can insert intro_slides'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can insert intro_slides"
        ON public.intro_slides FOR INSERT
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intro_slides'
      AND policyname = 'Admins can update intro_slides'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can update intro_slides"
        ON public.intro_slides FOR UPDATE
        USING (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  ELSE
    EXECUTE $p$
      ALTER POLICY "Admins can update intro_slides"
        ON public.intro_slides
        USING (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intro_slides'
      AND policyname = 'Admins can delete intro_slides'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can delete intro_slides"
        ON public.intro_slides FOR DELETE
        USING (
          EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        );
    $p$;
  END IF;
END
$$;

