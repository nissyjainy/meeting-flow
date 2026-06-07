import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMeetTranscriptForCalendarEvent } from "./fetch-meet-transcript.server";
import { isGoogleCalendarConfigured } from "./env";
import { hasMeetTranscriptScope } from "./scopes";
import {
  deleteGoogleCalendarConnection,
  syncGoogleCalendarForUser,
} from "./sync-calendar.server";
import type { GoogleCalendarConnectionStatus, GoogleCalendarSyncResult } from "./types";
import type { MeetTranscriptFetchResult } from "./meet-transcript.types";

function buildConnectionStatus(input: {
  configured: boolean;
  scopes: string[] | null;
  googleAccountEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasRow: boolean;
}): GoogleCalendarConnectionStatus & { configured: boolean } {
  const hasMeetScope = hasMeetTranscriptScope(input.scopes ?? []);
  const hasSuccessfulSync = Boolean(input.lastSyncedAt) && !input.lastSyncError;
  const connected = input.hasRow && hasSuccessfulSync;

  return {
    configured: input.configured,
    connected,
    googleAccountEmail: input.googleAccountEmail,
    connectedAt: input.connectedAt,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    hasMeetTranscriptScope: hasMeetScope,
    needsReconnect: connected && !hasMeetScope,
  };
}

export const getGoogleCalendarConnectionStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleCalendarConnectionStatus & { configured: boolean }> => {
    const configured = isGoogleCalendarConfigured();
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return buildConnectionStatus({
        configured,
        scopes: null,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: null,
        hasRow: false,
      });
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return buildConnectionStatus({
        configured,
        scopes: null,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: "Server configuration incomplete.",
        hasRow: false,
      });
    }

    const { data, error } = await admin
      .from("google_calendar_connections")
      .select("google_account_email,connected_at,last_synced_at,last_sync_error,scopes")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return buildConnectionStatus({
        configured,
        scopes: null,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: error?.message ?? null,
        hasRow: false,
      });
    }

    return buildConnectionStatus({
      configured,
      scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : null,
      googleAccountEmail: data.google_account_email ?? null,
      connectedAt: data.connected_at ?? null,
      lastSyncedAt: data.last_synced_at ?? null,
      lastSyncError: data.last_sync_error ?? null,
      hasRow: true,
    });
  },
);

const FetchMeetTranscriptInput = z.object({
  calendarEventId: z.string().uuid(),
});

export const fetchMeetTranscriptFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FetchMeetTranscriptInput.parse(data))
  .handler(async ({ data }): Promise<MeetTranscriptFetchResult> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        success: false,
        code: "not_connected",
        message: "You must be signed in to fetch a transcript.",
      };
    }

    return fetchMeetTranscriptForCalendarEvent(user.id, data.calendarEventId);
  });

export const syncGoogleCalendarFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<GoogleCalendarSyncResult> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        cancelledCount: 0,
        error: "You must be signed in to sync Google Calendar.",
      };
    }

    return syncGoogleCalendarForUser(user.id);
  },
);

export const disconnectGoogleCalendarFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ success: boolean; error?: string }> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { success: false, error: "You must be signed in to disconnect Google Calendar." };
    }

    try {
      await deleteGoogleCalendarConnection(user.id);
      return { success: true };
    } catch (disconnectError) {
      return {
        success: false,
        error:
          disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
      };
    }
  },
);
