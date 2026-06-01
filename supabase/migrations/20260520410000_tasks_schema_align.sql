-- Align tasks table columns with app expectations (safe if already applied)

alter table public.tasks
  add column if not exists task text,
  add column if not exists owner text,
  add column if not exists deadline text,
  add column if not exists status text not null default 'open';

-- Backfill from legacy column names if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'description'
  ) then
    execute 'update public.tasks set task = coalesce(task, description) where task is null and description is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date'
  ) then
    execute 'update public.tasks set deadline = coalesce(deadline, due_date) where deadline is null and due_date is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'description'
  ) then
    execute 'alter table public.tasks alter column description drop not null';
  end if;
end $$;

create index if not exists tasks_meeting_id_idx on public.tasks (meeting_id);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
  on public.tasks for select to authenticated using (true);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
  on public.tasks for insert to authenticated with check (true);

drop policy if exists "tasks_delete_authenticated" on public.tasks;
create policy "tasks_delete_authenticated"
  on public.tasks for delete to authenticated using (true);
