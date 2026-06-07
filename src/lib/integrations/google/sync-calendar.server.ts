import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { wrapSupabaseError } from "@/lib/supabase/errors";
import { fetchGoogleCalendarMeetEvents } from "./calendar-client";
import { getGoogleOAuthConfig } from "./env";
import { refreshGoogleAccessToken, tokenExpiresAt } from "./oauth";
import type {
  GoogleCalendarConnectionRow,
  GoogleCalendarSyncResult,
  NormalizedGoogleCalendarEvent,
} from "./types";
import { GOOGLE_INTEGRATION_SCOPES } from "./scopes";

function throwSyncError(error: { message: string }): never {
  throw wrapSupabaseError(error, "sync calendar_events");
}

export async function loadGoogleCalendarConnection(
  userId: string,
): Promise<GoogleCalendarConnectionRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar sync.");
  }

  const { data, error } = await admin
    .from("google_calendar_connections")
    .select(
      "user_id,google_account_email,access_token,refresh_token,token_expires_at,scopes,connected_at,last_synced_at,last_sync_error",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GoogleCalendarConnectionRow | null) ?? null;
}

export async function ensureFreshGoogleAccessToken(
  connection: GoogleCalendarConnectionRow,
): Promise<{ accessToken: string; connection: GoogleCalendarConnectionRow }> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google Calendar is not configured.");
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const needsRefresh = expiresAt <= Date.now() + 5 * 60 * 1000;

  if (!needsRefresh) {
    return { accessToken: connection.access_token, connection };
  }

  const refreshed = await refreshGoogleAccessToken(config, connection.refresh_token);
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar sync.");
  }

  const nextConnection: GoogleCalendarConnectionRow = {
    ...connection,
    access_token: refreshed.access_token,
    token_expires_at: tokenExpiresAt(refreshed.expires_in),
  };

  const { error } = await admin
    .from("google_calendar_connections")
    .update({
      access_token: nextConnection.access_token,
      token_expires_at: nextConnection.token_expires_at,
    })
    .eq("user_id", connection.user_id);

  if (error) {
    throw new Error(error.message);
  }

  return { accessToken: nextConnection.access_token, connection: nextConnection };
}

function buildSyncWindow(
  horizonDays: number,
  lookbackDays: number,
): { timeMin: string; timeMax: string } {
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}

async function upsertCalendarEvents(
  userId: string,
  events: NormalizedGoogleCalendarEvent[],
): Promise<{ importedCount: number; updatedCount: number; cancelledCount: number }> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar sync.");
  }

  const nowIso = new Date().toISOString();
  let importedCount = 0;
  let updatedCount = 0;

  for (const event of events) {
    const { data: existing, error: existingError } = await admin
      .from("calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("google_calendar_id", event.googleCalendarId)
      .eq("google_event_id", event.googleEventId)
      .maybeSingle();

    if (existingError) {
      throwSyncError(existingError);
    }

    const row = {
      user_id: userId,
      google_event_id: event.googleEventId,
      google_calendar_id: event.googleCalendarId,
      title: event.title,
      organizer_email: event.organizerEmail,
      organizer_name: event.organizerName,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      attendees: event.attendees,
      meet_link: event.meetingUrl,
      platform: event.platform,
      meeting_url: event.meetingUrl,
      meeting_code: event.meetingCode,
      google_conference_id: event.googleConferenceId,
      status: event.cancelled ? "cancelled" : "scheduled",
      synced_at: nowIso,
    };

    if (existing?.id) {
      const { error } = await admin.from("calendar_events").update(row).eq("id", existing.id);
      if (error) throwSyncError(error);
      updatedCount += 1;
    } else {
      const { error } = await admin
        .from("calendar_events")
        .insert({ ...row, capture_status: "discovered" });
      if (error) throwSyncError(error);
      importedCount += 1;
    }
  }

  const activeIds = new Set(events.map((event) => event.googleEventId));
  const syncConfig = getGoogleOAuthConfig();
  const { timeMin, timeMax } = buildSyncWindow(
    syncConfig?.syncHorizonDays ?? 30,
    syncConfig?.syncLookbackDays ?? 14,
  );

  const { data: storedEvents, error: storedError } = await admin
    .from("calendar_events")
    .select("id,google_event_id")
    .eq("user_id", userId)
    .eq("google_calendar_id", "primary")
    .eq("status", "scheduled")
    .gte("starts_at", timeMin)
    .lte("starts_at", timeMax);

  if (storedError) {
    throwSyncError(storedError);
  }

  let cancelledCount = 0;
  for (const stored of storedEvents ?? []) {
    if (activeIds.has(String(stored.google_event_id))) continue;

    const { error } = await admin
      .from("calendar_events")
      .update({ status: "cancelled", synced_at: nowIso })
      .eq("id", stored.id);

    if (error) throwSyncError(error);
    cancelledCount += 1;
  }

  return { importedCount, updatedCount, cancelledCount };
}

export async function syncGoogleCalendarForUser(userId: string): Promise<GoogleCalendarSyncResult> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      cancelledCount: 0,
      error: "Google Calendar is not configured.",
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      cancelledCount: 0,
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar sync.",
    };
  }

  try {
    const connection = await loadGoogleCalendarConnection(userId);
    if (!connection) {
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        cancelledCount: 0,
        error: "Google Calendar is not connected.",
      };
    }

    const { accessToken } = await ensureFreshGoogleAccessToken(connection);
    const { timeMin, timeMax } = buildSyncWindow(config.syncHorizonDays, config.syncLookbackDays);
    const events = await fetchGoogleCalendarMeetEvents(accessToken, { timeMin, timeMax });
    const counts = await upsertCalendarEvents(userId, events);

    await admin
      .from("google_calendar_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("user_id", userId);

    return {
      success: true,
      ...counts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await admin
      .from("google_calendar_connections")
      .update({ last_sync_error: message })
      .eq("user_id", userId);

    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      cancelledCount: 0,
      error: message,
    };
  }
}

export async function saveGoogleCalendarConnection(input: {
  userId: string;
  googleAccountEmail: string | null;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar connect.");
  }

  const { error } = await admin.from("google_calendar_connections").upsert(
    {
      user_id: input.userId,
      google_account_email: input.googleAccountEmail,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: tokenExpiresAt(input.expiresIn),
      scopes: [...GOOGLE_INTEGRATION_SCOPES],
      connected_at: new Date().toISOString(),
      last_sync_error: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteGoogleCalendarConnection(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Google Calendar disconnect.");
  }

  const { error } = await admin.from("google_calendar_connections").delete().eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

