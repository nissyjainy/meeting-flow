-- Ensure summary column + status allows 'completed' (fixes silent DB update failures)

alter table public.meetings
  add column if not exists summary text;

alter table public.meetings
  add column if not exists status text;

update public.meetings
set status = 'processing'
where status is null;

alter table public.meetings
  alter column status set default 'processing';

-- Drop legacy constraints that only allow 'ready' instead of 'completed'
alter table public.meetings drop constraint if exists meetings_status_check;

alter table public.meetings
  add constraint meetings_status_check
  check (status in ('processing', 'completed', 'failed', 'ready'));
