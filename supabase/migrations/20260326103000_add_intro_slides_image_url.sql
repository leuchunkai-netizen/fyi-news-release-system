-- Add optional image URL for guest intro/feature slides
ALTER TABLE public.intro_slides
ADD COLUMN IF NOT EXISTS image_url varchar(1000);

COMMENT ON COLUMN public.intro_slides.image_url IS 'Optional slide image URL shown on guest home.';

