import { readServerEnv } from "@/lib/server-env";
import { extractJwtProjectRef, extractSupabaseProjectRef } from "./project-ref";

function readClientEnv(key: string): string | undefined {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveSupabaseUrl(): string | undefined {
  const fromWorker = readServerEnv("VITE_SUPABASE_URL");
  const fromClient = readClientEnv("VITE_SUPABASE_URL");
  const resolved = fromWorker ?? fromClient;

  const serviceRoleRef = extractJwtProjectRef(readServerEnv("SUPABASE_SERVICE_ROLE_KEY"));
  if (!serviceRoleRef) return resolved;

  const resolvedRef = extractSupabaseProjectRef(resolved);
  if (resolvedRef === serviceRoleRef) return resolved;

  const aligned = `https://${serviceRoleRef}.supabase.co`;
  console.warn(
    `[supabase-env] VITE_SUPABASE_URL ref ${resolvedRef ?? "(none)"} mismatches SUPABASE_SERVICE_ROLE_KEY ref ${serviceRoleRef}; using ${aligned}`,
  );
  return aligned;
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
