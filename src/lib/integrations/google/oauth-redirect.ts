export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/integrations/google/callback";

export function isCanonicalGoogleOAuthCallback(redirectUri: string): boolean {
  try {
    return new URL(redirectUri).pathname === GOOGLE_OAUTH_CALLBACK_PATH;
  } catch {
    return false;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** Build callback URL from an incoming request origin (production-safe). */
export function googleOAuthRedirectUriFromRequest(requestUrl: string): string {
  const origin = originOf(requestUrl);
  if (!origin) {
    throw new Error("Invalid request URL for Google OAuth redirect resolution.");
  }
  return `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

/**
 * Resolve the redirect_uri sent to Google.
 * When APP_URL / GOOGLE_OAUTH_REDIRECT_URI still point at localhost but the user is on
 * production, prefer the live request origin so Cloudflare Workers do not send localhost.
 */
export function resolveGoogleOAuthRedirectUri(
  requestUrl: string | undefined,
  env: {
    appUrl?: string;
    explicitRedirectUri?: string;
  },
): string {
  const appUrl = (env.appUrl ?? "http://localhost:8080").replace(/\/$/, "");
  const fallback = `${appUrl}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  const explicit = env.explicitRedirectUri?.trim();

  if (!requestUrl) {
    return explicit || fallback;
  }

  const requestDerived = googleOAuthRedirectUriFromRequest(requestUrl);
  const requestOrigin = originOf(requestUrl);
  if (!requestOrigin) {
    if (explicit && isCanonicalGoogleOAuthCallback(explicit)) {
      return explicit;
    }
    return fallback;
  }

  if (explicit && isCanonicalGoogleOAuthCallback(explicit)) {
    const explicitOrigin = originOf(explicit);
    if (
      explicitOrigin &&
      isLocalhostOrigin(explicitOrigin) &&
      !isLocalhostOrigin(requestOrigin)
    ) {
      return requestDerived;
    }
    return explicit;
  }

  if (explicit && !isCanonicalGoogleOAuthCallback(explicit)) {
    return requestDerived;
  }

  const appOrigin = originOf(appUrl);
  if (appOrigin && isLocalhostOrigin(appOrigin) && !isLocalhostOrigin(requestOrigin)) {
    return requestDerived;
  }

  return fallback;
}

export function resolveAppBaseFromRedirectUri(redirectUri: string): string {
  return redirectUri.replace(/\/api\/.*$/, "");
}
