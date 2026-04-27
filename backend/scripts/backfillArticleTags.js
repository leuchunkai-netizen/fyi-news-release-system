const path = require("path");
const dotenv = require("dotenv");
const { getSupabaseAdmin } = require("../db/supabaseClient");
const { generateArticleTags } = require("../services/articleTags");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function normalizeTags(input) {
  const list = Array.isArray(input) ? input : [];
  return Array.from(
    new Set(
      list
        .map((tag) => String(tag || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 8);
}

async function run() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new Error(
      "Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env."
    );
  }

  const onlyMissing = process.argv.includes("--only-missing");
  const dryRun = process.argv.includes("--dry-run");

  const { data: articles, error } = await sb
    .from("articles")
    .select("id, title, content, tags")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!articles || articles.length === 0) {
    console.log("No articles found.");
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of articles) {
    const existingTags = normalizeTags(article.tags);
    const content = String(article.content || "").trim();

    if (onlyMissing && existingTags.length > 0) {
      skipped += 1;
      continue;
    }

    if (!content) {
      skipped += 1;
      continue;
    }

    processed += 1;
    try {
      const result = await generateArticleTags({
        title: article.title || "",
        content,
      });
      const nextTags = normalizeTags(result.tags);

      if (nextTags.length === 0) {
        skipped += 1;
        console.log(`[skip] ${article.id} (no tags generated)`);
        continue;
      }

      const unchanged =
        existingTags.length === nextTags.length &&
        existingTags.every((tag, i) => tag === nextTags[i]);
      if (unchanged) {
        skipped += 1;
        console.log(`[skip] ${article.id} (tags unchanged)`);
        continue;
      }

      if (!dryRun) {
        const { error: upErr } = await sb
          .from("articles")
          .update({ tags: nextTags, updated_at: new Date().toISOString() })
          .eq("id", article.id);
        if (upErr) throw upErr;
      }

      updated += 1;
      console.log(
        `[ok] ${article.id} -> ${nextTags.join(", ")}${dryRun ? " (dry-run)" : ""}`
      );
    } catch (e) {
      failed += 1;
      console.error(`[err] ${article.id}: ${e.message || e}`);
    }
  }

  console.log(
    `Done. processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`
  );
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
