-- Add AI summary + pipeline status to meetings (safe to re-run)

alter table public.meetings
  add column if not exists summary text,
  add column if not exists status text not null default 'processing';

-- Allow completed status after transcript + summary pipeline
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings
  add constraint meetings_status_check
  check (status in ('processing', 'completed', 'failed'));

create index if not exists meetings_status_created_at_idx
  on public.meetings (status, created_at desc);
