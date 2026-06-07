import { readServerEnv } from "@/lib/server-env";

function readClientEnv(key: string): string | undefined {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveSupabaseUrl(): string | undefined {
  return readServerEnv("VITE_SUPABASE_URL") ?? readClientEnv("VITE_SUPABASE_URL");
}

function resolveSupabasePublishableKey(): string | undefined {
  return (
    readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    readClientEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    readServerEnv("VITE_SUPABASE_ANON_KEY") ??
    readClientEnv("VITE_SUPABASE_ANON_KEY")
  );
}

/** Resolves Supabase URL/key at call time (Worker bindings override build-time VITE_*). */
export function getSupabaseEnv() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublishableKey();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, key };
}
