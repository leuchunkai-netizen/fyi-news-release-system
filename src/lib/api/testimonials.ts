import { supabase } from "../supabase";
import { apiUrl } from "./apiBase";
import type { TestimonialRow } from "../types/database";

/** Fetch approved testimonials (for guest landing). */
export async function getApprovedTestimonials(): Promise<TestimonialRow[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Submit a testimonial (guest or authenticated). */
export async function submitTestimonial(params: {
  name: string;
  role: string;
  message: string;
  rating: number;
  user_id?: string | null;
}) {
  const moderationRes = await fetch(apiUrl("/api/users/testimonials/moderate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: params.message }),
  });
  const moderation = await moderationRes.json().catch(() => null);
  if (!moderationRes.ok) {
    throw new Error(
      moderation?.reason || "Could not run language moderation. Please try again."
    );
  }
  const decision = moderation?.decision as string | undefined;
  if (decision === "needs_revision" || moderation?.allowed === false) {
    throw new Error(
      moderation?.reason ||
        "Your testimonial could not be accepted as written. Please revise and try again."
    );
  }
  const status =
    decision === "auto_approve" ? "approved" : "pending";

  const { data, error } = await supabase
    .from("testimonials")
    .insert({
      name: params.name,
      role: params.role,
      message: params.message,
      rating: params.rating,
      user_id: params.user_id ?? null,
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TestimonialRow;
}
