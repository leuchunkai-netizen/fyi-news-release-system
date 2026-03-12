-- Allow authenticated users to delete only their own comments.
-- Admin delete policy remains separate.

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);
