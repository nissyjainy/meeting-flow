-- Per-meeting attendees for owner → email mapping and reminders

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists team_members_meeting_id_idx
  on public.team_members (meeting_id);

alter table public.team_members enable row level security;

drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_authenticated"
  on public.team_members for select
  to authenticated
  using (true);

drop policy if exists "team_members_insert_authenticated" on public.team_members;
create policy "team_members_insert_authenticated"
  on public.team_members for insert
  to authenticated
  with check (true);

drop policy if exists "team_members_update_authenticated" on public.team_members;
create policy "team_members_update_authenticated"
  on public.team_members for update
  to authenticated
  using (true);

drop policy if exists "team_members_delete_authenticated" on public.team_members;
create policy "team_members_delete_authenticated"
  on public.team_members for delete
  to authenticated
  using (true);
