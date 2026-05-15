-- Experts may only view/update pending articles in categories matching their approved expertise.

CREATE OR REPLACE FUNCTION public.expert_matches_category(p_category_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expert_applications ea
    INNER JOIN public.categories c ON c.id = p_category_id
    CROSS JOIN LATERAL unnest(string_to_array(ea.expertise, ',')) AS raw_entry(entry)
    WHERE ea.user_id = p_user_id
      AND ea.status = 'approved'
      AND trim(entry) <> ''
      AND (
        lower(trim(entry)) = lower(c.name)
        OR lower(trim(entry)) = lower(c.slug)
        OR replace(lower(trim(entry)), ' ', '-') = lower(c.slug)
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.role = 'expert'
  );
$$;

COMMENT ON FUNCTION public.expert_matches_category IS
  'True when p_user_id is an expert with approved expertise matching the category name or slug.';

DROP POLICY IF EXISTS "Experts can view pending articles" ON public.articles;

CREATE POLICY "Experts can view pending articles in their categories"
  ON public.articles FOR SELECT
  USING (
    status = 'pending'
    AND public.expert_matches_category(category_id)
  );

DROP POLICY IF EXISTS "Experts can update pending articles for review" ON public.articles;

CREATE POLICY "Experts can update pending articles in their categories"
  ON public.articles FOR UPDATE
  USING (
    status = 'pending'
    AND public.expert_matches_category(category_id)
  )
  WITH CHECK (
    status IN ('published', 'rejected', 'pending')
    AND public.expert_matches_category(category_id)
  );
