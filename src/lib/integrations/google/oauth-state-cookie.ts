import { getCookie, getCookies, setCookie } from "@tanstack/react-start/server";
import { googleOAuthDebug } from "./oauth-debug";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

export type OAuthStateCookieSerializeOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
  path: "/";
};

/** Secure only on HTTPS — avoids dropping cookies on http://localhost in prod builds. */
export function oauthStateCookieOptions(requestUrl: string): OAuthStateCookieSerializeOptions {
  let secure = false;
  try {
    secure = new URL(requestUrl).protocol === "https:";
  } catch {
    secure = false;
  }

  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 600,
    path: "/",
  };
}

export function formatSetCookieHeader(
  name: string,
  value: string,
  options: OAuthStateCookieSerializeOptions,
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Max-Age=${options.maxAge}`);
  parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function readOAuthStateCookie(request: Request): string | undefined {
  const fromFramework = getCookie(GOOGLE_OAUTH_STATE_COOKIE);
  if (fromFramework) {
    return fromFramework;
  }

  const header = request.headers.get("cookie");
  if (!header) return undefined;

  const prefix = `${GOOGLE_OAUTH_STATE_COOKIE}=`;
  const part = header
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  if (!part) return undefined;

  const raw = part.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function oauthStatesMatch(state: string, cookieState: string | undefined): boolean {
  if (!cookieState) return false;
  if (state === cookieState) return true;

  try {
    return decodeURIComponent(state) === decodeURIComponent(cookieState);
  } catch {
    return false;
  }
}

export function validateOAuthOriginsMatch(
  requestUrl: string,
  redirectUri: string,
): { ok: true } | { ok: false; requestOrigin: string; redirectOrigin: string } {
  const requestOrigin = new URL(requestUrl).origin;
  const redirectOrigin = new URL(redirectUri).origin;
  if (requestOrigin === redirectOrigin) {
    return { ok: true };
  }
  return { ok: false, requestOrigin, redirectOrigin };
}

export function clearOAuthStateCookie(requestUrl: string): void {
  const options = oauthStateCookieOptions(requestUrl);
  setCookie(GOOGLE_OAUTH_STATE_COOKIE, "", { ...options, maxAge: 0 });
}

/**
 * TanStack Start merges setCookie into handler responses, but server route redirects
 * can drop pending cookies. Append Set-Cookie explicitly on the redirect response.
 */
export function redirectWithOAuthStateCookie(
  redirectUrl: string,
  stateValue: string,
  request: Request,
): Response {
  const options = oauthStateCookieOptions(request.url);
  setCookie(GOOGLE_OAUTH_STATE_COOKIE, stateValue, options);

  const headers = new Headers({ Location: redirectUrl });
  headers.append(
    "Set-Cookie",
    formatSetCookieHeader(GOOGLE_OAUTH_STATE_COOKIE, stateValue, options),
  );

  googleOAuthDebug("connect:set-cookie", {
    redirectUrl,
    requestOrigin: new URL(request.url).origin,
    cookieSecure: options.secure,
    stateLength: stateValue.length,
  });

  return new Response(null, { status: 302, headers });
}

export function logOAuthCallbackValidation(
  request: Request,
  redirectUri: string,
  state: string | null,
  cookieState: string | undefined,
  code: string | null,
): void {
  googleOAuthDebug("callback:validate", {
    redirectUri,
    requestUrl: request.url,
    requestOrigin: new URL(request.url).origin,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasCookieState: Boolean(cookieState),
    statesMatch: state ? oauthStatesMatch(state, cookieState) : false,
    requestCookieHeader: request.headers.get("cookie") ?? "",
    frameworkCookieNames: Object.keys(getCookies()),
    statePreview: state ? `${state.slice(0, 36)}…` : null,
    cookieStatePreview: cookieState ? `${cookieState.slice(0, 36)}…` : null,
  });
}

export function invalidStateReason(
  code: string | null,
  state: string | null,
  cookieState: string | undefined,
): string {
  if (!code) return "missing_code";
  if (!state) return "missing_state";
  if (!cookieState) return "missing_cookie";
  if (!oauthStatesMatch(state, cookieState)) return "state_mismatch";
  return "unknown";
}
