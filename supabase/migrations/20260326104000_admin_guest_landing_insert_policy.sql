-- Allow admins to insert the singleton guest landing settings row
DO $$
BEGIN
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
END
$$;

