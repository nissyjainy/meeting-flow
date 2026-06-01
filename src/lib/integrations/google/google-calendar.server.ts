import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isGoogleCalendarConfigured } from "./env";
import {
  deleteGoogleCalendarConnection,
  syncGoogleCalendarForUser,
} from "./sync-calendar.server";
import type { GoogleCalendarConnectionStatus, GoogleCalendarSyncResult } from "./types";

export const getGoogleCalendarConnectionStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleCalendarConnectionStatus & { configured: boolean }> => {
    const configured = isGoogleCalendarConfigured();
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        configured,
        connected: false,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: null,
      };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return {
        configured,
        connected: false,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: "Server configuration incomplete.",
      };
    }

    const { data, error } = await admin
      .from("google_calendar_connections")
      .select("google_account_email,connected_at,last_synced_at,last_sync_error")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return {
        configured,
        connected: false,
        googleAccountEmail: null,
        connectedAt: null,
        lastSyncedAt: null,
        lastSyncError: error?.message ?? null,
      };
    }

    const hasSuccessfulSync = Boolean(data.last_synced_at) && !data.last_sync_error;

    return {
      configured,
      connected: hasSuccessfulSync,
      googleAccountEmail: data.google_account_email ?? null,
      connectedAt: data.connected_at ?? null,
      lastSyncedAt: data.last_synced_at ?? null,
      lastSyncError: data.last_sync_error ?? null,
    };
  },
);

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
