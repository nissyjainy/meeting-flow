-- Meetings metadata + Storage bucket for recordings
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  file_name text not null,
  file_path text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  transcript_text text,
  transcript_status text not null default 'queued'
    check (transcript_status in ('queued', 'transcribing', 'completed', 'failed')),
  transcript_error text,
  transcript_attempts int not null default 0 check (transcript_attempts >= 0),
  transcript_started_at timestamptz,
  transcript_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_file_path_unique unique (file_path)
);

create index if not exists meetings_user_id_created_at_idx
  on public.meetings (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_meetings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at
  before update on public.meetings
  for each row
  execute function public.set_meetings_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.meetings enable row level security;

drop policy if exists "meetings_select_own" on public.meetings;
create policy "meetings_select_own"
  on public.meetings for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "meetings_insert_own" on public.meetings;
create policy "meetings_insert_own"
  on public.meetings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "meetings_update_own" on public.meetings;
create policy "meetings_update_own"
  on public.meetings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "meetings_delete_own" on public.meetings;
create policy "meetings_delete_own"
  on public.meetings for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meetings',
  'meetings',
  false,
  524288000, -- 500 MB
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'video/mp4'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {user_id}/{meeting_id}/{filename}
drop policy if exists "meetings_storage_select_own" on storage.objects;
create policy "meetings_storage_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "meetings_storage_insert_own" on storage.objects;
create policy "meetings_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "meetings_storage_update_own" on storage.objects;
create policy "meetings_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "meetings_storage_delete_own" on storage.objects;
create policy "meetings_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
