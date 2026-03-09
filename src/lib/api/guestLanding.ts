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
  const { data, error } = await supabase
    .from("guest_landing_settings")
    .update(updates)
    .select()
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GuestSettingsRow | null;
}

/** Replace all intro slides (admin). Deletes existing and inserts the given slides. */
export async function upsertIntroSlides(slides: { category: string; title: string; excerpt: string }[]) {
  const { error: delError } = await supabase.from("intro_slides").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw delError;
  if (slides.length === 0) return [];
  const rows = slides.map((s, i) => ({
    sort_order: i + 1,
    category: s.category,
    title: s.title,
    excerpt: s.excerpt,
  }));
  const { data, error } = await supabase.from("intro_slides").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as IntroSlideRow[];
}
