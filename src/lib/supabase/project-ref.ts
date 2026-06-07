/** Extract the Supabase project ref from a project URL (e.g. `uzddznccxnolcarxykbc`). */
export function extractSupabaseProjectRef(url: string | undefined): string | null {
  if (!url?.trim()) return null;

  try {
    const hostname = new URL(url.trim()).hostname;
    const ref = hostname.split(".")[0]?.trim();
    return ref || null;
  } catch {
    return null;
  }
}

export function isSupabaseSchemaCacheError(message: string): boolean {
  return /schema cache/i.test(message) && /column/i.test(message);
}

export function formatSupabaseSchemaError(
  message: string,
  context: string,
  projectUrl: string | undefined,
): string {
  const ref = extractSupabaseProjectRef(projectUrl);
  const projectHint = ref
    ? `Supabase project \`${ref}\` (${projectUrl})`
    : projectUrl
      ? `Supabase URL ${projectUrl}`
      : "configured Supabase project";

  return `${message} (${context}; ${projectHint}). If the column exists in the database, run NOTIFY pgrst, 'reload schema'; on that project and redeploy with matching VITE_SUPABASE_URL / Worker secrets.`;
}
