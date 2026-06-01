-- Re-apply upload RLS policies (safe to run if policies already exist).
-- Run in Supabase SQL Editor if uploads fail with:
--   "new row violates row-level security policy"

-- Meetings table policies
drop policy if exists "meetings_select_own" on public.meetings;
create policy "meetings_select_own"
  on public.meetings for select
  to authenticated
  

drop policy if exists "meetings_insert_own" on public.meetings;
create policy "meetings_insert_own"
  on public.meetings for insert
  to authenticated
  

drop policy if exists "meetings_update_own" on public.meetings;
create policy "meetings_update_own"
  on public.meetings for update
  to authenticated
  

drop policy if exists "meetings_delete_own" on public.meetings;
create policy "meetings_delete_own"
  on public.meetings for delete
  to authenticated
  

-- Storage policies (upload writes to storage.objects)
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
