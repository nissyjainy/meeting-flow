export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type GoogleCalendarConnectionRow = {
  user_id: string;
  google_account_email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  googleAccountEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasMeetTranscriptScope: boolean;
  needsReconnect: boolean;
};

export type GoogleCalendarSyncResult = {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  cancelledCount: number;
  error?: string;
};

import type { MeetingPlatform } from "@/lib/meetings/detect-meeting-platform";

export type NormalizedGoogleCalendarEvent = {
  googleEventId: string;
  googleCalendarId: string;
  title: string;
  organizerEmail: string | null;
  organizerName: string | null;
  startsAt: string;
  endsAt: string;
  attendees: Array<{
    email: string;
    displayName: string | null;
    responseStatus: string | null;
  }>;
  /** @deprecated Use meetingUrl — kept for backward compatibility during sync. */
  meetLink: string | null;
  meetingUrl: string | null;
  meetingCode: string | null;
  googleConferenceId: string | null;
  platform: MeetingPlatform | null;
  cancelled: boolean;
};
