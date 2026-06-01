-- Action items extracted from meeting transcripts (post-summary pipeline)

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  description text not null,
  owner text,
  due_date text,
  created_at timestamptz not null default now()
);

create index if not exists tasks_meeting_id_idx
  on public.tasks (meeting_id);

create index if not exists tasks_created_at_idx
  on public.tasks (created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
  on public.tasks for select
  to authenticated
  using (true);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
  on public.tasks for insert
  to authenticated
  with check (true);

drop policy if exists "tasks_delete_authenticated" on public.tasks;
create policy "tasks_delete_authenticated"
  on public.tasks for delete
  to authenticated
  using (true);
