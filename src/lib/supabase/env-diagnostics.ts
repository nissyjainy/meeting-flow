import { resolveServerEnv } from "@/lib/server-env";
import { getSupabaseEnv } from "./env";
import { extractJwtProjectRef, extractSupabaseProjectRef } from "./project-ref";

export type SupabaseEnvDiagnostics = {
  resolvedUrl: string;
  resolvedProjectRef: string | null;
  buildTimeUrl: string | null;
  buildTimeProjectRef: string | null;
  workerUrl: string | null;
  workerProjectRef: string | null;
  serviceRoleProjectRef: string | null;
  urlSource: string;
  publishableKeySource: string;
  serviceRoleConfigured: boolean;
  urlAlignedToServiceRole: boolean;
  projectRefsMatch: boolean;
};

function readClientEnv(key: string): string | undefined {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const urlResolution = resolveServerEnv("VITE_SUPABASE_URL");
  const keyResolution = resolveServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = resolveServerEnv("SUPABASE_SERVICE_ROLE_KEY").value;

  const buildTimeUrl = readClientEnv("VITE_SUPABASE_URL") ?? null;
  const workerUrl =
    urlResolution.source === "worker-env" ? (urlResolution.value ?? null) : null;

  let resolved: { url: string };
  try {
    resolved = getSupabaseEnv();
  } catch {
    resolved = { url: urlResolution.value ?? buildTimeUrl ?? "" };
  }

  const resolvedProjectRef = extractSupabaseProjectRef(resolved.url);
  const buildTimeProjectRef = extractSupabaseProjectRef(buildTimeUrl ?? undefined);
  const workerProjectRef = extractSupabaseProjectRef(workerUrl ?? undefined);
  const serviceRoleProjectRef = extractJwtProjectRef(serviceRoleKey);

  const refs = [resolvedProjectRef, serviceRoleProjectRef, buildTimeProjectRef, workerProjectRef].filter(
    (ref): ref is string => Boolean(ref),
  );
  const projectRefsMatch = refs.length === 0 || refs.every((ref) => ref === refs[0]);

  return {
    resolvedUrl: resolved.url,
    resolvedProjectRef,
    buildTimeUrl,
    buildTimeProjectRef,
    workerUrl,
    workerProjectRef,
    serviceRoleProjectRef,
    urlSource: urlResolution.source,
    publishableKeySource: keyResolution.source,
    serviceRoleConfigured: Boolean(serviceRoleKey),
    urlAlignedToServiceRole:
      Boolean(serviceRoleProjectRef) && resolvedProjectRef === serviceRoleProjectRef,
    projectRefsMatch,
  };
}
