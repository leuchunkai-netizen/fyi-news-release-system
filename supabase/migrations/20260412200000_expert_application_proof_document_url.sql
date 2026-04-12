-- Proof document (image/PDF) uploaded with expert applications; shown in admin review.
ALTER TABLE public.expert_applications
  ADD COLUMN IF NOT EXISTS proof_document_url text;

COMMENT ON COLUMN public.expert_applications.proof_document_url IS 'Public URL of uploaded credentials (Supabase Storage); optional for legacy rows';
