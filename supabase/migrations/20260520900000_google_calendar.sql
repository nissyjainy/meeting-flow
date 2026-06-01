-- Google Calendar integration: OAuth connections + imported calendar events

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_account_email text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default array['https://www.googleapis.com/auth/calendar.readonly'],
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text
);

alter table public.google_calendar_connections enable row level security;

-- No client policies: tokens are read/written only via service role on the server.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_event_id text not null,
  google_calendar_id text not null default 'primary',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  attendees jsonb not null default '[]'::jsonb,
  meet_link text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  linked_meeting_id uuid references public.meetings (id) on delete set null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_calendar_id, google_event_id)
);

create index if not exists calendar_events_user_starts_at_idx
  on public.calendar_events (user_id, starts_at asc);

create index if not exists calendar_events_user_status_starts_at_idx
  on public.calendar_events (user_id, status, starts_at asc);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own"
  on public.calendar_events for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own"
  on public.calendar_events for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own"
  on public.calendar_events for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own"
  on public.calendar_events for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.set_calendar_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row
  execute function public.set_calendar_events_updated_at();
