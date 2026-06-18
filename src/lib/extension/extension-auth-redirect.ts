import { normalizeAuthRedirectPath } from "@/lib/auth/redirect-path";
import { isValidExtensionRedirectUri } from "@/lib/extension/auth-handshake.server";

export const EXTENSION_AUTH_REDIRECT_URI_COOKIE = "meetflow_extension_redirect_uri";
export const EXTENSION_AUTH_COOKIE_MAX_AGE_SECONDS = 600;

const DEFAULT_POST_AUTH_PATH = "/";

export function buildExtensionAuthPath(redirectUri: string): string {
  return `/extension/auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export function parseExtensionRedirectUriFromAuthPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/extension/auth")) {
    return null;
  }

  try {
    const url = new URL(trimmed, "https://meetflow.invalid");
    const redirectUri = url.searchParams.get("redirect_uri")?.trim() ?? "";
    return isValidExtensionRedirectUri(redirectUri) ? redirectUri : null;
  } catch {
    return null;
  }
}

export function buildExtensionAuthRedirectUriCookie(redirectUri: string): string {
  const value = encodeURIComponent(redirectUri);
  return `${EXTENSION_AUTH_REDIRECT_URI_COOKIE}=${value}; Path=/; Max-Age=${EXTENSION_AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure; HttpOnly`;
}

export function buildClearExtensionAuthRedirectUriCookie(): string {
  return `${EXTENSION_AUTH_REDIRECT_URI_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

export function readExtensionRedirectUriCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${EXTENSION_AUTH_REDIRECT_URI_COOKIE}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const raw = trimmed.slice(prefix.length);
    if (!raw) {
      return null;
    }
    try {
      const redirectUri = decodeURIComponent(raw);
      return isValidExtensionRedirectUri(redirectUri) ? redirectUri : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolve where to send the browser after web login / OAuth callback.
 * Recovers extension OAuth when the `redirect` query param was dropped.
 */
export function resolvePostAuthRedirectPath(
  redirectParam: string | null | undefined,
  cookieHeader: string | null,
): string {
  const normalized = normalizeAuthRedirectPath(redirectParam);
  if (normalized !== DEFAULT_POST_AUTH_PATH) {
    return normalized;
  }

  const cookieRedirectUri = readExtensionRedirectUriCookie(cookieHeader);
  if (cookieRedirectUri) {
    return buildExtensionAuthPath(cookieRedirectUri);
  }

  return normalized;
}

export function shouldClearExtensionAuthCookie(destinationPath: string): boolean {
  return destinationPath.startsWith("/extension/auth");
}
