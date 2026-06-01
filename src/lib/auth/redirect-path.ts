const DEFAULT_PATH = "/";

/**
 * Normalize a post-login redirect to a same-origin path (no scheme/host).
 * Prevents double-origin concatenation in OAuth redirectTo URLs.
 */
export function normalizeAuthRedirectPath(redirect?: string | null): string {
  if (!redirect?.trim()) {
    return DEFAULT_PATH;
  }

  const trimmed = redirect.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const path = `${url.pathname}${url.search}${url.hash}`;
      return path.startsWith("/") ? path : DEFAULT_PATH;
    } catch {
      return DEFAULT_PATH;
    }
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_PATH;
  }

  return trimmed;
}

/** Build an absolute URL for Supabase OAuth using a path-only redirect target. */
export function buildOAuthRedirectUrl(origin: string, redirectPath?: string | null): string {
  const path = normalizeAuthRedirectPath(redirectPath);
  return `${origin.replace(/\/$/, "")}${path}`;
}
