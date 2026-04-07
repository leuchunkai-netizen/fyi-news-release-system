const { getSupabaseAdmin } = require("./supabaseClient");

/**
 * Optional pgvector similarity search via a Postgres RPC (e.g. match_document_chunks).
 * Set PGVECTOR_MATCH_RPC in backend/.env after running backend/db/pgvector.sql (or your variant).
 *
 * @param {number[]} queryEmbedding
 * @param {number} matchCount
 * @returns {Promise<Array<{ title?: string, source?: string, content?: string, similarity?: number }>>}
 */
async function matchCorpusChunks(queryEmbedding, matchCount = 8) {
  const rpcName = process.env.PGVECTOR_MATCH_RPC;
  if (!rpcName || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb.rpc(rpcName, {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) {
    console.warn("[pgvector] RPC error:", error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

module.exports = { matchCorpusChunks };
