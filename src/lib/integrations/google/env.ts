import { readServerEnv } from "@/lib/server-env";
import {
  resolveAppBaseFromRedirectUri,
  resolveGoogleOAuthRedirectUri,
} from "./oauth-redirect";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  syncHorizonDays: number;
  syncLookbackDays: number;
};

export function getGoogleOAuthConfig(requestUrl?: string): GoogleOAuthConfig | null {
  const clientId = readServerEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readServerEnv("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return null;
  }

  const redirectUri = resolveGoogleOAuthRedirectUri(requestUrl, {
    appUrl: readServerEnv("APP_URL"),
    explicitRedirectUri: readServerEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  });

  const horizonRaw = readServerEnv("GOOGLE_CALENDAR_SYNC_HORIZON_DAYS");
  const syncHorizonDays = horizonRaw ? Math.max(1, Number.parseInt(horizonRaw, 10) || 30) : 30;

  const lookbackRaw = readServerEnv("GOOGLE_CALENDAR_SYNC_LOOKBACK_DAYS");
  const syncLookbackDays = lookbackRaw ? Math.max(0, Number.parseInt(lookbackRaw, 10) || 14) : 14;

  return {
    clientId,
    clientSecret,
    redirectUri,
    syncHorizonDays,
    syncLookbackDays,
  };
}

export function isGoogleCalendarConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}

export function getGoogleOAuthAppBase(requestUrl?: string): string {
  const config = getGoogleOAuthConfig(requestUrl);
  if (config) {
    return resolveAppBaseFromRedirectUri(config.redirectUri);
  }

  const redirectUri = resolveGoogleOAuthRedirectUri(requestUrl, {
    appUrl: readServerEnv("APP_URL"),
    explicitRedirectUri: readServerEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  });
  return resolveAppBaseFromRedirectUri(redirectUri);
}
