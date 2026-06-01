-- Track when tasks were last modified (used for "completed this week" dashboard metric)

alter table public.tasks
  add column if not exists updated_at timestamptz not null default now();

update public.tasks
set updated_at = created_at
where updated_at is null;

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.set_tasks_updated_at();
