// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load .env.local at config evaluation time so server bundles receive real secrets via `define`.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

const serverEnvDefine = {
  "process.env.RESEND_API_KEY": JSON.stringify(env.RESEND_API_KEY ?? ""),
  "process.env.RESEND_FROM_EMAIL": JSON.stringify(env.RESEND_FROM_EMAIL ?? ""),
  "process.env.REMINDER_EMAIL_TO": JSON.stringify(env.REMINDER_EMAIL_TO ?? ""),
  "process.env.APP_URL": JSON.stringify(env.APP_URL ?? ""),
  "process.env.CRON_SECRET": JSON.stringify(env.CRON_SECRET ?? ""),
  "process.env.GROQ_API_KEY": JSON.stringify(env.GROQ_API_KEY ?? ""),
  "process.env.GOOGLE_CLIENT_ID": JSON.stringify(env.GOOGLE_CLIENT_ID ?? ""),
  "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(env.GOOGLE_CLIENT_SECRET ?? ""),
  "process.env.GOOGLE_OAUTH_REDIRECT_URI": JSON.stringify(env.GOOGLE_OAUTH_REDIRECT_URI ?? ""),
  "process.env.GOOGLE_CALENDAR_SYNC_HORIZON_DAYS": JSON.stringify(
    env.GOOGLE_CALENDAR_SYNC_HORIZON_DAYS ?? "",
  ),
} as const;

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    envPrefix: [
      "VITE_",
      "RESEND_",
      "GROQ_",
      "APP_",
      "REMINDER_",
      "CRON_",
      "SUPABASE_",
      "GOOGLE_",
    ],
    define: serverEnvDefine,
  },
});
