-- Matches application schema: id, file_name, file_url, transcript, created_at
-- Run in Supabase SQL Editor if your table differs.

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_url text not null,
  transcript text,
  created_at timestamptz not null default now()
);

create index if not exists meetings_created_at_idx
  on public.meetings (created_at desc);

-- Storage bucket for audio/video files (file_url stores the object path)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meetings',
  'meetings',
  false,
  524288000,
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

-- Allow authenticated users to upload into their own folder: {user_id}/...
drop policy if exists "meetings_storage_insert_own" on storage.objects;
create policy "meetings_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meetings'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "meetings_storage_select_own" on storage.objects;
create policy "meetings_storage_select_own"
  on storage.objects for select
  to authenticated
  using (
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
