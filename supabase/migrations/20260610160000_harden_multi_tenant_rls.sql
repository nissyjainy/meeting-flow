-- Harden multi-tenant RLS: scope child tables to meeting owners.
--
-- Production meetings table stores owner in file_url path:
-- {owner_uuid}/{meeting_id}/{filename} (same layout as storage.objects).

-- ---------------------------------------------------------------------------
-- Helper: meeting owner check via file_url path (production schema)
-- ---------------------------------------------------------------------------
create or replace function public.meeting_owned_by_auth_user(meeting_uuid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.meetings m
    where m.id = meeting_uuid
      and m.file_url is not null
      and split_part(m.file_url, '/', 1) = (select auth.uid())::text
  );
$$;

comment on function public.meeting_owned_by_auth_user(uuid) is
  'True when meetings.file_url first segment matches auth.uid() (storage path owner).';

-- ---------------------------------------------------------------------------
-- meetings (file_url-scoped RLS; insert must check NEW.file_url directly)
-- ---------------------------------------------------------------------------
alter table public.meetings enable row level security;

drop policy if exists "meetings_select_own" on public.meetings;
create policy "meetings_select_own"
  on public.meetings for select
  to authenticated
  using (public.meeting_owned_by_auth_user(id));

drop policy if exists "meetings_insert_own" on public.meetings;
create policy "meetings_insert_own"
  on public.meetings for insert
  to authenticated
  with check (
    file_url is not null
    and split_part(file_url, '/', 1) = (select auth.uid())::text
  );

drop policy if exists "meetings_update_own" on public.meetings;
create policy "meetings_update_own"
  on public.meetings for update
  to authenticated
  using (public.meeting_owned_by_auth_user(id))
  with check (
    file_url is not null
    and split_part(file_url, '/', 1) = (select auth.uid())::text
  );

drop policy if exists "meetings_delete_own" on public.meetings;
create policy "meetings_delete_own"
  on public.meetings for delete
  to authenticated
  using (public.meeting_owned_by_auth_user(id));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
drop policy if exists "tasks_select_authenticated" on public.tasks;
drop policy if exists "tasks_select_own_meeting" on public.tasks;
create policy "tasks_select_own_meeting"
  on public.tasks for select
  to authenticated
  using (public.meeting_owned_by_auth_user(tasks.meeting_id));

drop policy if exists "tasks_insert_authenticated" on public.tasks;
drop policy if exists "tasks_insert_own_meeting" on public.tasks;
create policy "tasks_insert_own_meeting"
  on public.tasks for insert
  to authenticated
  with check (public.meeting_owned_by_auth_user(tasks.meeting_id));

drop policy if exists "tasks_update_authenticated" on public.tasks;
drop policy if exists "tasks_update_own_meeting" on public.tasks;
create policy "tasks_update_own_meeting"
  on public.tasks for update
  to authenticated
  using (public.meeting_owned_by_auth_user(tasks.meeting_id))
  with check (public.meeting_owned_by_auth_user(tasks.meeting_id));

drop policy if exists "tasks_delete_authenticated" on public.tasks;
drop policy if exists "tasks_delete_own_meeting" on public.tasks;
create policy "tasks_delete_own_meeting"
  on public.tasks for delete
  to authenticated
  using (public.meeting_owned_by_auth_user(tasks.meeting_id));

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------
drop policy if exists "team_members_select_authenticated" on public.team_members;
drop policy if exists "team_members_select_own_meeting" on public.team_members;
create policy "team_members_select_own_meeting"
  on public.team_members for select
  to authenticated
  using (public.meeting_owned_by_auth_user(team_members.meeting_id));

drop policy if exists "team_members_insert_authenticated" on public.team_members;
drop policy if exists "team_members_insert_own_meeting" on public.team_members;
create policy "team_members_insert_own_meeting"
  on public.team_members for insert
  to authenticated
  with check (public.meeting_owned_by_auth_user(team_members.meeting_id));

drop policy if exists "team_members_update_authenticated" on public.team_members;
drop policy if exists "team_members_update_own_meeting" on public.team_members;
create policy "team_members_update_own_meeting"
  on public.team_members for update
  to authenticated
  using (public.meeting_owned_by_auth_user(team_members.meeting_id))
  with check (public.meeting_owned_by_auth_user(team_members.meeting_id));

drop policy if exists "team_members_delete_authenticated" on public.team_members;
drop policy if exists "team_members_delete_own_meeting" on public.team_members;
create policy "team_members_delete_own_meeting"
  on public.team_members for delete
  to authenticated
  using (public.meeting_owned_by_auth_user(team_members.meeting_id));

-- ---------------------------------------------------------------------------
-- meeting_chunks (authenticated read only; writes remain service_role)
-- ---------------------------------------------------------------------------
drop policy if exists "meeting_chunks_select_authenticated" on public.meeting_chunks;
drop policy if exists "meeting_chunks_select_own_meeting" on public.meeting_chunks;
create policy "meeting_chunks_select_own_meeting"
  on public.meeting_chunks for select
  to authenticated
  using (public.meeting_owned_by_auth_user(meeting_chunks.meeting_id));

-- meeting_chunks_service_all (service_role) unchanged — pipeline indexing/deletes

-- ---------------------------------------------------------------------------
-- task_status_events
-- ---------------------------------------------------------------------------
drop policy if exists "task_status_events_select_authenticated" on public.task_status_events;
drop policy if exists "task_status_events_select_own_meeting" on public.task_status_events;
create policy "task_status_events_select_own_meeting"
  on public.task_status_events for select
  to authenticated
  using (public.meeting_owned_by_auth_user(task_status_events.meeting_id));

drop policy if exists "task_status_events_insert_authenticated" on public.task_status_events;
drop policy if exists "task_status_events_insert_own_meeting" on public.task_status_events;
create policy "task_status_events_insert_own_meeting"
  on public.task_status_events for insert
  to authenticated
  with check (public.meeting_owned_by_auth_user(task_status_events.meeting_id));

-- No authenticated UPDATE/DELETE policies (append-only audit log).

-- ---------------------------------------------------------------------------
-- reminder_sends
-- ---------------------------------------------------------------------------
drop policy if exists "reminder_sends_select_authenticated" on public.reminder_sends;
drop policy if exists "reminder_sends_select_own_meeting" on public.reminder_sends;
create policy "reminder_sends_select_own_meeting"
  on public.reminder_sends for select
  to authenticated
  using (public.meeting_owned_by_auth_user(reminder_sends.meeting_id));

drop policy if exists "reminder_sends_insert_authenticated" on public.reminder_sends;
drop policy if exists "reminder_sends_insert_own_meeting" on public.reminder_sends;
create policy "reminder_sends_insert_own_meeting"
  on public.reminder_sends for insert
  to authenticated
  with check (
    reminder_sends.meeting_id is not null
    and public.meeting_owned_by_auth_user(reminder_sends.meeting_id)
  );

-- No authenticated UPDATE/DELETE policies (server logs via service_role).

-- ---------------------------------------------------------------------------
-- match_meeting_chunks — owner-scoped semantic search for authenticated callers
-- ---------------------------------------------------------------------------
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
  where (
    (select auth.role()) = 'service_role'
    or public.meeting_owned_by_auth_user(mc.meeting_id)
  )
    and (filter_meeting_id is null or mc.meeting_id = filter_meeting_id)
  order by mc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_meeting_chunks(vector, int, uuid) to authenticated;
grant execute on function public.match_meeting_chunks(vector, int, uuid) to service_role;
