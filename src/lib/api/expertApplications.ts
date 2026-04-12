import { supabase } from "../supabase";

/** Submit an expert verification application (authenticated user). */
export async function submitExpertApplication(
  userId: string,
  expertise: string,
  credentials: string,
  proofDocumentUrl?: string | null
) {
  const { error } = await supabase.from("expert_applications").insert({
    user_id: userId,
    expertise,
    credentials,
    status: "pending",
    ...(proofDocumentUrl ? { proof_document_url: proofDocumentUrl } : {}),
  });
  if (error) throw error;
}
