# Semantic retrieval architecture (MeetFlow Assistant)

## Goal

Improve Assistant answer quality by replacing keyword snippet retrieval with **pgvector semantic search** over transcript chunks, without changing the Assistant UI, routes, or workspace analytics flow.

## Components

| Layer | Responsibility |
|--------|----------------|
| `transcript-chunking.ts` | Split transcripts into ~500–800 word chunks with 100-word overlap |
| `embeddings-groq.ts` | Generate embeddings via Groq `nomic-embed-text-v1_5` (768 dims) |
| `meeting-chunks-index.server.ts` | Chunk + embed + upsert into `meeting_chunks` after transcription |
| `meeting_chunks` (Postgres) | Stores `meeting_id`, `chunk_index`, `chunk_text`, `embedding` |
| `match_meeting_chunks` (RPC) | Cosine similarity search with optional `filter_meeting_id` |
| `assistant-vector-search.server.ts` | Query embedding + RPC + group chunks by meeting |
| `assistant-retrieval.server.ts` | Vector-first retrieval with keyword fallback |
| `assistant-query.server.ts` | Existing `askAssistantFn` pipeline (unchanged UX) |
| `assistant-context.server.ts` | Builds LLM context from retrieved passages + tasks |
| `assistant-analytics-context.server.ts` | Unchanged workspace analytics block |

## Data flow

### Indexing (on transcript completion)

```
runTranscribeMeeting()
  → save transcript to meetings
  → indexMeetingTranscriptChunks()
      → chunkTranscript()
      → generateEmbeddings() (batched Groq calls)
      → delete old meeting_chunks for meeting_id
      → insert new rows
```

Indexing is **non-fatal** — transcription/summary pipeline continues if indexing fails.

### Query (Assistant)

```
askAssistantFn(query, optional meetingId)
  → loadAssistantCorpus() + loadAssistantWorkspaceAnalytics()
  → retrieveAssistantMeetingHits()
      → vector: embed query → match_meeting_chunks RPC
      → fallback: keyword strategy if vector fails/empty
      → pin meeting when meetingId focus is set
  → buildAssistantAnalyticsContext() + buildAssistantContextWindow()
  → generateAssistantAnswer() (Groq chat)
  → append Sources (meeting title + date)
```

## Meeting focus mode

When `meetingId` is provided (`/assistant?meetingId=…`):

1. Vector RPC filters with `filter_meeting_id`.
2. `pinMeetingInSearchHits` ensures the focused meeting remains in context if keyword fallback runs.

## Security

- `meeting_chunks` RLS: `authenticated` can `SELECT`; `service_role` can write.
- `match_meeting_chunks` runs as **security invoker** so RLS applies.
- Chunk indexing uses the same Supabase client as transcription (user bearer or service role).

## Limits

| Setting | Value |
|---------|--------|
| Chunk size | 500–800 words, 100-word overlap |
| Embedding model | `nomic-embed-text-v1_5` (768) |
| Chunks per query | 12 (grouped to ≤8 meetings) |
| LLM context budget | 28k chars (unchanged) |

## Fallback behavior

Keyword retrieval (`KeywordAssistantSearchStrategy`) remains available when:

- `meeting_chunks` table/RPC not migrated yet
- Groq embeddings API errors
- No chunks indexed yet for the workspace
