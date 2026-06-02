# MeetFlow

AI meeting intelligence for modern teams. MeetFlow transcribes recordings, generates summaries, extracts action items, and keeps your team accountable with reminders and execution insights.

## Features

- **Meeting uploads** — Upload audio/video recordings for transcription, AI summaries, and task extraction
- **Tasks & reminders** — Track action items and send owner reminder emails via Resend
- **Google Calendar** — Import upcoming meetings (read-only OAuth)
- **Team insights** — Per-owner accountability metrics and execution health dashboards
- **AI Copilot** — Ask questions about your meetings and tasks (partial MVP)

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- Optional: Groq API key (transcription/summary), Resend (email reminders), Google OAuth (calendar)

### Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Run Supabase migrations — see [supabase/README.md](supabase/README.md).

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:8080](http://localhost:8080) and sign in at `/login`.

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |
| `npm test`        | Run unit tests           |
| `npm run lint`    | ESLint                   |

## Deployment

The app targets Cloudflare Workers via TanStack Start. Configure `wrangler.jsonc` and deploy with Wrangler after setting production environment variables.

## License

Private — all rights reserved.
