import { supabase } from "../supabase";
import type { CategoryRow } from "../types/database";

/** List all categories (for filters, dropdowns, admin). */
export async function getCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Get category by slug. */
export async function getCategoryBySlug(slug: string) {
  const { data, error } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as CategoryRow | null;
}
