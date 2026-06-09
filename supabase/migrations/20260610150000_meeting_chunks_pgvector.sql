-- Semantic retrieval: transcript chunks + pgvector embeddings for MeetFlow Assistant

create extension if not exists vector;

create table if not exists public.meeting_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  chunk_text text not null check (char_length(chunk_text) > 0),
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  constraint meeting_chunks_meeting_chunk_unique unique (meeting_id, chunk_index)
);

create index if not exists meeting_chunks_meeting_id_idx
  on public.meeting_chunks (meeting_id);

create index if not exists meeting_chunks_user_id_idx
  on public.meeting_chunks (user_id);

create index if not exists meeting_chunks_embedding_hnsw_idx
  on public.meeting_chunks
  using hnsw (embedding vector_cosine_ops);

comment on table public.meeting_chunks is 'Transcript chunks with embeddings for Assistant semantic retrieval';
comment on column public.meeting_chunks.chunk_index is 'Stable order within the parent meeting transcript';
comment on column public.meeting_chunks.embedding is 'Groq nomic-embed-text-v1_5 vector (768 dimensions)';

alter table public.meeting_chunks enable row level security;

drop policy if exists "meeting_chunks_select_authenticated" on public.meeting_chunks;
create policy "meeting_chunks_select_authenticated"
  on public.meeting_chunks for select
  to authenticated
  using (true);

drop policy if exists "meeting_chunks_service_all" on public.meeting_chunks;
create policy "meeting_chunks_service_all"
  on public.meeting_chunks for all
  to service_role
  using (true)
  with check (true);

-- Cosine similarity search; RLS on meeting_chunks applies for authenticated callers.
create or replace function public.match_meeting_chunks(
  query_embedding vector(768),
  match_count int default 12,
  filter_meeting_id uuid default null
)
returns table (
  meeting_id uuid,
  chunk_index int,
  chunk_text text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    mc.meeting_id,
    mc.chunk_index,
    mc.chunk_text,
    1 - (mc.embedding <=> query_embedding) as similarity
  from public.meeting_chunks mc
  where filter_meeting_id is null or mc.meeting_id = filter_meeting_id
  order by mc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_meeting_chunks(vector, int, uuid) to authenticated;
grant execute on function public.match_meeting_chunks(vector, int, uuid) to service_role;
