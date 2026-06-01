import { readServerEnv } from "@/lib/server-env";

type EnvRequirement = {
  key: string;
  hint: string;
  read: () => string | undefined;
};

const SERVER_REQUIREMENTS: EnvRequirement[] = [
  {
    key: "GROQ_API_KEY",
    hint: "Add GROQ_API_KEY to .env.local (server-side; no VITE_ prefix).",
    read: () => readServerEnv("GROQ_API_KEY"),
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local for calendar sync and admin operations.",
    read: () => readServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    key: "VITE_SUPABASE_URL",
    hint: "Add VITE_SUPABASE_URL to .env.local from Supabase project settings.",
    read: () => readServerEnv("VITE_SUPABASE_URL") ?? readClientEnv("VITE_SUPABASE_URL"),
  },
  {
    key: "VITE_SUPABASE_PUBLISHABLE_KEY",
    hint:
      "Add VITE_SUPABASE_PUBLISHABLE_KEY (anon/publishable key) to .env.local from Supabase project settings.",
    read: () =>
      readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
      readClientEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
      readServerEnv("VITE_SUPABASE_ANON_KEY") ??
      readClientEnv("VITE_SUPABASE_ANON_KEY"),
  },
];

function readClientEnv(key: string): string | undefined {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

let loggedServerValidation = false;
let loggedClientValidation = false;

function logMissingVars(context: string, missing: EnvRequirement[]): void {
  console.error(`[startup-env] ${context}: missing required environment variable(s):`);
  for (const req of missing) {
    console.error(`[startup-env]   ✗ ${req.key} — ${req.hint}`);
  }
}

function logAllPresent(context: string): void {
  console.info(`[startup-env] ${context}: all required environment variables are set.`);
}

/** Server/worker startup — logs missing vars; does not throw (allows app to boot for diagnostics). */
export function validateServerStartupEnv(context = "server"): void {
  if (loggedServerValidation) return;
  loggedServerValidation = true;

  const missing = SERVER_REQUIREMENTS.filter((req) => !req.read());
  if (missing.length > 0) {
    logMissingVars(context, missing);
    return;
  }

  logAllPresent(context);
}

/** Client boot — validates VITE_* vars visible in the browser bundle. */
export function validateClientStartupEnv(context = "client"): void {
  if (loggedClientValidation) return;
  loggedClientValidation = true;

  const clientKeys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;
  const missing: EnvRequirement[] = [];

  for (const key of clientKeys) {
    const value = readClientEnv(key) ?? (key === "VITE_SUPABASE_PUBLISHABLE_KEY" ? readClientEnv("VITE_SUPABASE_ANON_KEY") : undefined);
    if (!value) {
      missing.push(
        SERVER_REQUIREMENTS.find((r) => r.key === key) ?? {
          key,
          hint: `Add ${key} to .env.local.`,
          read: () => undefined,
        },
      );
    }
  }

  if (missing.length > 0) {
    logMissingVars(context, missing);
    return;
  }

  logAllPresent(context);
}
