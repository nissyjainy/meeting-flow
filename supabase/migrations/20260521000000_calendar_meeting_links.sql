-- Universal meeting link detection: platform + meeting_url on imported calendar events.

alter table public.calendar_events
  add column if not exists platform text
    check (platform in ('Zoom', 'Google Meet', 'Microsoft Teams', 'Unknown')),
  add column if not exists meeting_url text;

comment on column public.calendar_events.platform is 'Detected video platform (Zoom, Google Meet, Microsoft Teams, Unknown)';
comment on column public.calendar_events.meeting_url is 'Detected join URL from conferenceData, location, or description';

-- Backfill from legacy meet_link column.
update public.calendar_events
set
  meeting_url = meet_link,
  platform = case
    when meet_link ilike '%meet.google.com%' or meet_link ilike '%hangouts.google.com%' then 'Google Meet'
    when meet_link ilike '%zoom.us%' or meet_link ilike '%zoom.com%' then 'Zoom'
    when meet_link ilike '%teams.microsoft.com%' or meet_link ilike '%teams.live.com%' then 'Microsoft Teams'
    when meet_link is not null then 'Unknown'
    else null
  end
where meet_link is not null
  and meeting_url is null;
