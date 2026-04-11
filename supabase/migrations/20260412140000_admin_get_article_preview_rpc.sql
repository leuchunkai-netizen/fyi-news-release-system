-- Admin article preview must load suspended (status = flagged) rows. Direct REST + .single()
-- can return 406 when RLS yields zero visible rows, or when the client rejects the response shape.
-- This RPC runs as definer after an admin check and returns one JSON object (or NULL if missing).

CREATE OR REPLACE FUNCTION public.admin_get_article_preview(p_article_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  a public.articles%ROWTYPE;
  cat jsonb;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can load this article preview';
  END IF;

  SELECT * INTO a FROM public.articles WHERE id = p_article_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF a.category_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
    INTO cat
    FROM public.categories c
    WHERE c.id = a.category_id;
  ELSE
    cat := NULL;
  END IF;

  RETURN to_jsonb(a) || jsonb_build_object('category', cat);
END;
$$;

COMMENT ON FUNCTION public.admin_get_article_preview(uuid) IS
  'Returns articles.* plus category {id,name,slug} for admin preview; not restricted by public article visibility RLS.';

GRANT EXECUTE ON FUNCTION public.admin_get_article_preview(uuid) TO authenticated;
