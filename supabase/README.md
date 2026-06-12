# Supabase setup for meeting uploads

## 1. Run the migration

Open the [SQL Editor](https://supabase.com/dashboard/project/_/sql) for your project and run:

`migrations/20260520200000_meetings_schema.sql`

Then run `migrations/20260520300000_meetings_summary.sql` and `migrations/20260520310000_fix_summary_status.sql` for AI summary + `status` column.

Then run `migrations/20260521000000_meeting_transcript_error.sql` for transcription failure messages (`transcript_error` column). Upload inserts select this column; without it PostgREST returns **"column meetings.transcript_error does not exist"**.

Then run `migrations/20260520400000_meeting_tasks.sql` and `migrations/20260520410000_tasks_schema_align.sql` for extracted action items (`tasks` table).

Then run `migrations/20260520500000_team_members.sql` for per-meeting attendee name/email mapping (`team_members` table).

Then run `migrations/20260520600000_task_status.sql` for task status updates (`pending`, `in_progress`, `completed`) and UPDATE RLS.

Then run `migrations/20260520700000_reminder_sends.sql` for dashboard reminder analytics (`reminder_sends` table).

Table columns: `id`, `file_name`, `file_url`, `transcript`, `summary`, `status`, `transcript_error`, `created_at`.

`tasks` table: `meeting_id`, `task`, `owner`, `deadline`, `status` (default `pending`; values: `pending`, `in_progress`, `completed`), `created_at`. Legacy `open` is backfilled to `pending`. Overdue is derived at read/reminder time, not stored.

`team_members` table: `meeting_id`, `name`, `email`, `created_at`.

If uploads fail with **"new row violates row-level security policy"**, the error is from **Storage** (`storage.objects`). Run the storage policies in the same migration file, or `migrations/20260520100000_fix_upload_rls.sql`.

This creates:

- `public.meetings` table (metadata)
- Row Level Security policies
- Private `meetings` storage bucket with MIME/size limits

## 2. Verify storage bucket

In **Storage**, confirm a bucket named `meetings` exists (private).

## 3. Test in MeetFlow

1. Sign in at `/login`
2. Go to **Meetings** → **Upload recording**
3. Drag & drop or browse an `.mp3`, `.mp4`, `.wav`, or `.m4a` file (max 500 MB)

Uploads appear under **Your uploads** and open at `/meetings/{id}` with playback.

## Task reminder emails (Resend)

Add to `.env.local` (restart `npm run dev` after changes):

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`
- `REMINDER_EMAIL_TO` — recommended for local dev (used before auth email)
- Optional: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

**Automatic:** after task extraction when tasks exist in DB — sends **overdue / due-today / upcoming** reminders to matched task owners (via `team_members` name → email). Manual **Test reminders** includes pending tasks as well.

**Manual test (dev):** open a meeting → **Test reminders** button.

**Cron (local dev):** sends **overdue / due-today / upcoming** owner digest emails across all meetings.

```bash
curl -X POST http://localhost:8080/api/cron/task-reminders
```

In dev, `CRON_SECRET` is optional. In production, send `Authorization: Bearer <CRON_SECRET>`.

Watch the terminal for `[meeting-reminders]` logs.
