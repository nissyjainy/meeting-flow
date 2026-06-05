-- Store transcription failure messages on meetings (safe to re-run)

alter table public.meetings
  add column if not exists transcript_error text;
