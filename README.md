# MeetFlow

AI-powered meeting assistant for Google Meet, Zoom, and Teams.

MeetFlow captures meeting audio, transcribes conversations, generates summaries, extracts action items, and lets you query your meeting history with a cross-meeting AI assistant.

## Features

- **Meeting Recording** — Capture tab audio and microphone from Google Meet, Zoom, or Microsoft Teams via the Chrome extension, or upload recordings in the web app
- **AI Transcription** — Speech-to-text with Groq Whisper
- **AI Summaries** — Concise meeting summaries generated from transcripts
- **Action Item Extraction** — Tasks with owners and deadlines pulled from conversation context
- **AI Meeting Titles** — Automatic titles from calendar metadata, tab context, and transcript content
- **Cross-Meeting Assistant** — Ask questions across your full meeting corpus with cited sources
- **Semantic Search** — pgvector-backed retrieval over transcript chunks for relevant context

## Installation

### Web App

MeetFlow runs as a web application on Cloudflare Workers. For local use:

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Apply Supabase migrations — see [supabase/README.md](supabase/README.md).

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:8080](http://localhost:8080) and sign in.

Production deploys use Wrangler (`npx wrangler deploy`) with secrets configured in the Cloudflare dashboard.

### Chrome Extension

1. Open the install guide in the app: `/install` (e.g. `http://localhost:8080/install` locally).
2. Download the latest extension ZIP from [GitHub Releases](https://github.com/nissyjainy/meeting-flow/releases/latest).
3. Extract the archive.
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the extracted `extension` folder.
5. Sign in through the extension popup to connect with your MeetFlow account.

Update `extension/manifest.json` host permissions and `extension/background.js` default `meetflowUrl` if your deployment URL differs from `http://localhost:8080`.

## How It Works

1. **Capture** — The extension records meeting tab audio plus microphone input, or users upload audio/video files through the web app.
2. **Store** — Recordings are saved to private Supabase Storage; metadata is written to Postgres with row-level security per user.
3. **Transcribe** — A background pipeline sends audio to Groq for transcription.
4. **Enrich** — The same pipeline generates summaries, titles, and structured action items.
5. **Index** — Transcripts are chunked and embedded for semantic retrieval (Workers AI / pgvector).
6. **Assist** — The Assistant combines vector search, keyword retrieval, and workspace analytics to answer questions with meeting citations.

## Architecture

```text
Chrome Extension ──► Cloudflare Worker (TanStack Start)
                           │
                           ├── Groq (transcription, chat, titles, tasks)
                           ├── Workers AI (embeddings)
                           └── Supabase (Auth, Postgres, Storage, pgvector)
```

- **Extension** — Manifest V3 service worker, offscreen capture, OAuth handshake with the web app
- **API** — Server functions and REST routes for uploads, calendar sync, cron reminders, and extension auth
- **Database** — Meetings, tasks, calendar events, transcript chunks (`meeting_chunks`), and vector search RPCs
- **Storage** — Private `meetings` bucket scoped by user ID

## Tech Stack

- **React** — UI with TanStack Router / TanStack Start
- **Cloudflare Workers** — Edge deployment, cron triggers, Workers AI bindings
- **Supabase** — Auth, Postgres, Storage, RLS
- **pgvector** — Semantic search over transcript chunks
- **Groq** — Whisper transcription and LLM inference for summaries, tasks, and the Assistant

## Local Development

**Prerequisites:** Node.js 20+, a Supabase project, and a Groq API key for AI features.

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |
| `npm test`        | Run unit tests           |
| `npm run lint`    | ESLint                   |

After changing routes, the generated route tree (`src/routeTree.gen.ts`) should be committed when it updates.

## Environment Variables

Copy `.env.example` to `.env.local`. Server secrets are read at runtime — do not prefix sensitive keys with `VITE_`.

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (client + server) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `GROQ_API_KEY` | Yes* | Transcription, summaries, tasks, Assistant |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Calendar sync, extension auth, background pipelines |
| `APP_URL` | Recommended | OAuth redirects and email links |
| `RESEND_API_KEY` | Optional | Task reminder emails |
| `RESEND_FROM_EMAIL` | Optional | Reminder sender address |
| `CRON_SECRET` | Production | Protects `/api/cron/task-reminders` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar import |
| `REMINDER_EMAIL_TO` | Dev | Override reminder recipient locally |

\*Required for AI features; the app boots without it but transcription and Assistant will not run.

See `.env.example` for optional tuning (`GROQ_WHISPER_MODEL`, `GROQ_CHAT_MODEL`, calendar sync horizons, embedding model overrides).

## License

Private — all rights reserved.
