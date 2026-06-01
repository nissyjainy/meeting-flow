-- Phase A: task lifecycle timestamps for accountability analytics

alter table public.tasks
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null;

-- Backfill completed_at from last update time for already-completed tasks
update public.tasks
set completed_at = updated_at
where status = 'completed'
  and completed_at is null;

-- Weak backfill: in-progress tasks may have started at last update
update public.tasks
set started_at = updated_at
where status = 'in_progress'
  and started_at is null;

create index if not exists tasks_completed_at_idx
  on public.tasks (completed_at desc)
  where completed_at is not null;

create index if not exists tasks_started_at_idx
  on public.tasks (started_at desc)
  where started_at is not null;
