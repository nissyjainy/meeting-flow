-- Phase 1: Google Meet discovery metadata + schema for future transcript ingestion.

alter table public.calendar_events
  add column if not exists organizer_email text,
  add column if not exists organizer_name text,
  add column if not exists meeting_code text,
  add column if not exists google_conference_id text,
  add column if not exists capture_status text not null default 'discovered'
    check (capture_status in ('discovered', 'pending_capture', 'capturing', 'captured', 'failed')),
  add column if not exists transcript_source text
    check (transcript_source is null or transcript_source in ('manual_upload', 'google_meet_api', 'chrome_extension')),
  add column if not exists transcript_status text not null default 'not_started'
    check (transcript_status in ('not_started', 'queued', 'processing', 'completed', 'failed')),
  add column if not exists transcript_error text,
  add column if not exists transcript_fetched_at timestamptz;

comment on column public.calendar_events.organizer_email is 'Calendar event organizer email from Google Calendar API';
comment on column public.calendar_events.organizer_name is 'Calendar event organizer display name';
comment on column public.calendar_events.meeting_code is 'Google Meet code parsed from meet.google.com URL (e.g. abc-defg-hij)';
comment on column public.calendar_events.google_conference_id is 'Google conferenceData.conferenceId when present';
comment on column public.calendar_events.capture_status is 'Automatic capture pipeline state; Phase 1 sets discovered only';
comment on column public.calendar_events.transcript_source is 'How transcript was obtained (Phase 2+)';
comment on column public.calendar_events.transcript_status is 'Transcript ingestion state for linked capture';
comment on column public.calendar_events.transcript_error is 'Last transcript ingestion error message';
comment on column public.calendar_events.transcript_fetched_at is 'When transcript was last fetched from an external source';

create index if not exists calendar_events_user_meeting_code_idx
  on public.calendar_events (user_id, meeting_code)
  where meeting_code is not null;

create index if not exists calendar_events_user_capture_status_idx
  on public.calendar_events (user_id, capture_status, starts_at desc);
