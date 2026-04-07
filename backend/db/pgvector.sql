-- Run in Supabase SQL editor (enable pgvector, table, and match RPC).
-- Embeddings below assume OpenAI text-embedding-3-small dimensions (1536).
-- If you use another model, change vector(1536) and re-embed.
--
-- Alternative: keep embeddings in app memory or use FAISS in Node for offline
-- similarity if you do not want pgvector on Postgres.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles (id) on delete cascade,
  chunk_index int not null default 0,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz default now()
);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search (cosine distance; <=> is cosine distance for pgvector normalized vectors)
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id uuid,
  article_id uuid,
  content text,
  title text,
  source text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.article_id,
    dc.content,
    coalesce((dc.metadata->>'title')::text, '') as title,
    coalesce((dc.metadata->>'source')::text, 'corpus') as source,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  order by dc.embedding <=> query_embedding
  limit least(coalesce(match_count, 8), 50);
$$;

-- Grant execute for service role (adjust if you use a custom role)
grant execute on function public.match_document_chunks(vector(1536), int) to service_role;
