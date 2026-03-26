import { supabase } from "../supabase";
import type { Database } from "../types/database";

type GuestSettingsRow = Database["public"]["Tables"]["guest_landing_settings"]["Row"];
type IntroSlideRow = Database["public"]["Tables"]["intro_slides"]["Row"];

/** Get guest landing video section (single row). */
export async function getGuestLandingSettings(): Promise<GuestSettingsRow | null> {
  const { data, error } = await supabase
    .from("guest_landing_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GuestSettingsRow | null;
}

/** Get intro slides for guest home. */
export async function getIntroSlides(): Promise<IntroSlideRow[]> {
  const { data, error } = await supabase
    .from("intro_slides")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IntroSlideRow[];
}

/** Update guest landing video (admin). */
export async function updateGuestLandingSettings(updates: {
  video_title?: string;
  video_description?: string | null;
  video_url?: string | null;
}) {
  // Ensure the singleton row exists; if not, create one.
  const { data: existing, error: selectErr } = await supabase
    .from("guest_landing_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (selectErr) throw selectErr;

  if (!existing?.id) {
    const { data, error } = await supabase
      .from("guest_landing_settings")
      .insert({
        video_title: updates.video_title ?? "Welcome to our platform",
        video_description: updates.video_description ?? null,
        video_url: updates.video_url ?? null,
      })
      .select()
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error("Save failed (no row returned). Check RLS policies for guest_landing_settings INSERT.");
    }
    return data as GuestSettingsRow | null;
  }

  const { data, error } = await supabase
    .from("guest_landing_settings")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Save failed (no row updated). Check RLS policies for guest_landing_settings UPDATE and admin role.");
  }
  return data as GuestSettingsRow | null;
}

/** Replace all intro slides (admin). Deletes existing and inserts the given slides. */
export async function upsertIntroSlides(
  slides: { category: string; title: string; excerpt: string; imageUrl?: string }[]
) {
  const { error: delError } = await supabase.from("intro_slides").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw delError;
  if (slides.length === 0) return [];
  const rows = slides.map((s, i) => ({
    sort_order: i + 1,
    category: s.category,
    title: s.title,
    excerpt: s.excerpt,
    image_url: s.imageUrl?.trim() ? s.imageUrl.trim() : null,
  }));
  const { data, error } = await supabase.from("intro_slides").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as IntroSlideRow[];
}
