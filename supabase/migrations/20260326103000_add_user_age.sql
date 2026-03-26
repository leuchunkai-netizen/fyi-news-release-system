-- Add optional age field to users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age int CHECK (age IS NULL OR (age >= 13 AND age <= 120));

COMMENT ON COLUMN public.users.age IS 'Optional: user age (13-120)';
