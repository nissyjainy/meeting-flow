export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

export const GOOGLE_MEET_READONLY_SCOPE =
  "https://www.googleapis.com/auth/meetings.space.readonly";

export const GOOGLE_INTEGRATION_SCOPES = [
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GOOGLE_MEET_READONLY_SCOPE,
] as const;

export function hasMeetTranscriptScope(scopes: string[] | null | undefined): boolean {
  if (!scopes?.length) return false;
  return scopes.includes(GOOGLE_MEET_READONLY_SCOPE);
}

export function googleOAuthScopeParam(): string {
  return GOOGLE_INTEGRATION_SCOPES.join(" ");
}
