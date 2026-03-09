import { supabase } from "../supabase";
import { getCategories } from "./categories";

/** Set user interests by category names (e.g. from signup form). Replaces existing. */
export async function setUserInterests(userId: string, categoryNames: string[]) {
  if (categoryNames.length === 0) return;

  const categories = await getCategories();
  const nameToId = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const slugToId = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));

  const categoryIds: string[] = [];
  for (const name of categoryNames) {
    const id = nameToId.get(name.toLowerCase()) ?? slugToId.get(name.toLowerCase().replace(/\s+/g, "-"));
    if (id) categoryIds.push(id);
  }
  if (categoryIds.length === 0) return;

  await supabase.from("user_interests").delete().eq("user_id", userId);
  const rows = categoryIds.map((category_id) => ({ user_id: userId, category_id }));
  const { error } = await supabase.from("user_interests").insert(rows);
  if (error) throw error;
}

/** Get category names for a user (for profile/context). */
export async function getUserInterestNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_interests")
    .select("category_id")
    .eq("user_id", userId);
  if (error) throw error;
  if (!data?.length) return [];

  const categories = await getCategories();
  const idToName = new Map(categories.map((c) => [c.id, c.name]));
  return data.map((r) => idToName.get(r.category_id) ?? "").filter(Boolean);
}
