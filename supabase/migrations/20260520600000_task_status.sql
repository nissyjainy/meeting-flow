-- Task status management: pending | in_progress | completed (+ UPDATE RLS)

update public.tasks
set status = 'pending'
where status is null or status = 'open';

alter table public.tasks
  alter column status set default 'pending';

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending', 'in_progress', 'completed', 'open'));

drop policy if exists "tasks_update_authenticated" on public.tasks;
create policy "tasks_update_authenticated"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);
