-- Add optional profile fields (location, website) to users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location varchar(255),
  ADD COLUMN IF NOT EXISTS website varchar(500);

COMMENT ON COLUMN public.users.location IS 'Optional: user location, e.g. City, Country';
COMMENT ON COLUMN public.users.website IS 'Optional: personal or professional website URL';

