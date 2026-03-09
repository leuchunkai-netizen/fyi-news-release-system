import { supabase } from "../supabase";
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
  const { data, error } = await supabase
    .from("testimonials")
    .insert({
      name: params.name,
      role: params.role,
      message: params.message,
      rating: params.rating,
      user_id: params.user_id ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as TestimonialRow;
}
