-- Display metadata for extension and manual captures.

alter table public.meetings
  add column if not exists title text,
  add column if not exists platform text
    check (platform is null or platform in ('Zoom', 'Google Meet', 'Microsoft Teams', 'Unknown')),
  add column if not exists meeting_url text,
  add column if not exists meeting_code text;

comment on column public.meetings.title is 'Resolved display title (calendar, platform UI, tab, or code)';
comment on column public.meetings.platform is 'Video platform for the captured meeting';
comment on column public.meetings.meeting_url is 'Join URL at time of capture';
comment on column public.meetings.meeting_code is 'Platform meeting code when available';

create index if not exists meetings_user_meeting_code_idx
  on public.meetings (meeting_code)
  where meeting_code is not null;
