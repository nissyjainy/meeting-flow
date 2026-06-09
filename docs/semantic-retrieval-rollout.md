# Semantic retrieval rollout plan

## Prerequisites

- Supabase project with **pgvector** enabled (migration applies `create extension vector`).
- Production Worker has `GROQ_API_KEY` (already required).
- Optional: `GROQ_EMBEDDING_MODEL` (defaults to `nomic-embed-text-v1_5`).

## Step 1 — Apply database migration

Run in Supabase SQL editor or CLI:

```
supabase/migrations/20260610150000_meeting_chunks_pgvector.sql
```

Verify:

```sql
select count(*) from meeting_chunks;
select proname from pg_proc where proname = 'match_meeting_chunks';
```

## Step 2 — Deploy application

Deploy Worker build that includes:

- Transcript chunk indexing after transcription
- Vector retrieval in `askAssistantFn`

No extension or UI changes required.

## Step 3 — Backfill existing meetings (recommended)

Existing completed meetings have transcripts but no chunks until re-indexed.

Options:

1. **Natural backfill** — new recordings index automatically.
2. **Manual re-run** — trigger transcription pipeline again (not ideal).
3. **One-off script** (future) — load transcripts and call `indexMeetingTranscriptChunks` per meeting.

For MVP validation, capture one new meeting or re-upload a short test recording.

## Step 4 — Smoke tests

1. Upload / extension capture → wait for `completed`.
2. Confirm chunks exist:

   ```sql
   select meeting_id, chunk_index, left(chunk_text, 80)
   from meeting_chunks
   order by created_at desc
   limit 5;
   ```

3. Open `/assistant` and ask a topical question not matching exact keywords.
4. Open `/assistant?meetingId=<id>` and ask about that meeting.
5. Confirm answer includes **Sources** with meeting title and date.

## Step 5 — Monitor

- Worker logs: `[meeting-upload] meeting chunks index`, `[assistant] vector search`
- Groq embedding usage / rate limits
- Query latency (embedding + RPC + LLM)

## Rollback

1. Redeploy previous Worker version (keyword retrieval only).
2. Migration rollback optional — `meeting_chunks` can remain without affecting legacy behavior.

## Risk notes

- First query after deploy may still hit keyword fallback until chunks exist.
- Very short transcripts produce a single chunk (expected).
- RLS on `meeting_chunks` is permissive for `authenticated` SELECT; tighten to per-user if `meetings.user_id` is enforced in your schema.
