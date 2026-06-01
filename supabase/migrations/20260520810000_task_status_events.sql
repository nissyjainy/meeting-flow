-- Phase A: append-only task status event history

create table if not exists public.task_status_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  from_status text null,
  to_status text not null,
  actor_user_id uuid null,
  source text not null default 'app'
    check (source in ('app', 'extraction', 'backfill', 'system')),
  occurred_at timestamptz not null default now(),
  constraint task_status_events_to_status_check
    check (to_status in ('pending', 'in_progress', 'completed'))
);

create index if not exists task_status_events_task_id_occurred_idx
  on public.task_status_events (task_id, occurred_at desc);

create index if not exists task_status_events_meeting_id_occurred_idx
  on public.task_status_events (meeting_id, occurred_at desc);

create index if not exists task_status_events_occurred_at_idx
  on public.task_status_events (occurred_at desc);

alter table public.task_status_events enable row level security;

drop policy if exists "task_status_events_select_authenticated" on public.task_status_events;
create policy "task_status_events_select_authenticated"
  on public.task_status_events for select
  to authenticated
  using (true);

drop policy if exists "task_status_events_insert_authenticated" on public.task_status_events;
create policy "task_status_events_insert_authenticated"
  on public.task_status_events for insert
  to authenticated
  with check (true);

-- Synthetic backfill: one event per existing task reflecting current status
insert into public.task_status_events (
  task_id,
  meeting_id,
  from_status,
  to_status,
  source,
  occurred_at
)
select
  t.id,
  t.meeting_id,
  null,
  case
    when t.status in ('completed', 'done', 'closed') then 'completed'
    when t.status in ('in_progress', 'inprogress', 'progress') then 'in_progress'
    else 'pending'
  end,
  'backfill',
  coalesce(t.completed_at, t.started_at, t.updated_at, t.created_at)
from public.tasks t
where not exists (
  select 1
  from public.task_status_events e
  where e.task_id = t.id
    and e.source = 'backfill'
);
