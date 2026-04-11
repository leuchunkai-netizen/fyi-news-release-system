-- Snapshot reviewer identity on expert_reviews so all readers can see who published the review
-- without broadening SELECT on public.users.
ALTER TABLE public.expert_reviews
  ADD COLUMN IF NOT EXISTS expert_display_name text,
  ADD COLUMN IF NOT EXISTS expert_avatar text;

COMMENT ON COLUMN public.expert_reviews.expert_display_name IS 'Reviewer display name at submit time (public article page)';
COMMENT ON COLUMN public.expert_reviews.expert_avatar IS 'Reviewer avatar URL at submit time (public article page)';

UPDATE public.expert_reviews er
SET
  expert_display_name = COALESCE(er.expert_display_name, u.name),
  expert_avatar = COALESCE(er.expert_avatar, u.avatar)
FROM public.users u
WHERE u.id = er.expert_id
  AND (er.expert_display_name IS NULL OR er.expert_avatar IS NULL);
