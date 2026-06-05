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

/** Build the Supabase OAuth redirect URL — must hit /auth/callback to exchange the PKCE code. */
export function buildOAuthRedirectUrl(origin: string, finalRedirectPath?: string | null): string {
  const base = origin.replace(/\/$/, "");
  const callback = new URL("/auth/callback", base);
  const next = normalizeAuthRedirectPath(finalRedirectPath);
  if (next !== DEFAULT_PATH) {
    callback.searchParams.set("redirect", next);
  }
  return callback.toString();
}
