const { getSupabaseAdmin } = require("./supabaseClient");

/**
 * List published articles (for GET /api/articles). Requires service role + RLS bypass or policies.
 */
async function listPublishedArticles(limit = 20) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return { ok: true, source: "unconfigured", articles: [] };
  }
  const { data, error } = await sb
    .from("articles")
    .select("id, title, excerpt, status, published_at, category:categories(name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw error;
  return { ok: true, source: "supabase", articles: data ?? [] };
}

/**
 * Optional: insert draft/pending from server (if you move submit off the client).
 */
async function insertArticleRow(row) {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase admin not configured");
  const { data, error } = await sb.from("articles").insert(row).select().single();
  if (error) throw error;
  return data;
}

module.exports = {
  listPublishedArticles,
  insertArticleRow,
};
