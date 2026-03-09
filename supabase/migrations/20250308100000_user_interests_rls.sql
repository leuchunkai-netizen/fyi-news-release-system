-- RLS policies for user_interests (missing from initial schema)
-- Users can only view, insert, and delete their own interests.

CREATE POLICY "Users can view own interests"
  ON public.user_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests"
  ON public.user_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
  ON public.user_interests FOR DELETE
  USING (auth.uid() = user_id);
