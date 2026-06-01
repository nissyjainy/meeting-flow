-- Track reminder emails sent (dashboard analytics)

create table if not exists public.reminder_sends (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete set null,
  recipient text not null,
  subject text,
  sent_at timestamptz not null default now()
);

create index if not exists reminder_sends_sent_at_idx
  on public.reminder_sends (sent_at desc);

alter table public.reminder_sends enable row level security;

drop policy if exists "reminder_sends_select_authenticated" on public.reminder_sends;
create policy "reminder_sends_select_authenticated"
  on public.reminder_sends for select
  to authenticated
  using (true);

drop policy if exists "reminder_sends_insert_authenticated" on public.reminder_sends;
create policy "reminder_sends_insert_authenticated"
  on public.reminder_sends for insert
  to authenticated
  with check (true);
