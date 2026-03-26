-- Ensure admin can insert/update the singleton guest landing row reliably.
-- Some Postgres/Supabase setups require explicit WITH CHECK for UPDATE.

DO $$
BEGIN
  -- Create INSERT policy if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
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

  -- Ensure UPDATE policy has a WITH CHECK clause too
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_landing_settings'
      AND policyname = 'Admins can update guest landing settings'
  ) THEN
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
END
$$;

