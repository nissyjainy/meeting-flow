import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCalendarMeetingLifecycle } from "@/lib/calendar/meeting-lifecycle";
import { CALENDAR_EVENT_COLUMNS, mapCalendarEventRow } from "@/lib/calendar/api";
import { wrapSupabaseError } from "@/lib/supabase/errors";
import { assembleMeetTranscriptText } from "./assemble-meet-transcript";
import { isGoogleCalendarConfigured } from "./env";
import {
  buildConferenceRecordsFilter,
  conferenceRecordIdFromName,
  listConferenceRecords,
  listTranscriptEntries,
  listTranscripts,
  pickBestConferenceRecord,
  pickReadyTranscript,
} from "./meet-api-client";
import type {
  MeetTranscriptFetchErrorCode,
  MeetTranscriptFetchResult,
} from "./meet-transcript.types";
import { hasMeetTranscriptScope } from "./scopes";
import {
  ensureFreshGoogleAccessToken,
  loadGoogleCalendarConnection,
} from "./sync-calendar.server";

function failure(code: MeetTranscriptFetchErrorCode, message: string): MeetTranscriptFetchResult {
  return { success: false, code, message };
}

export async function fetchMeetTranscriptForCalendarEvent(
  userId: string,
  calendarEventId: string,
): Promise<MeetTranscriptFetchResult> {
  if (!isGoogleCalendarConfigured()) {
    return failure("not_configured", "Google integration is not configured on this server.");
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return failure("error", "SUPABASE_SERVICE_ROLE_KEY is required for Google Meet transcript fetch.");
  }

  const connection = await loadGoogleCalendarConnection(userId);
  if (!connection) {
    return failure("not_connected", "Google Calendar is not connected.");
  }

  if (!hasMeetTranscriptScope(connection.scopes)) {
    return failure(
      "needs_reconnect",
      "Reconnect Google to enable transcript capture.",
    );
  }

  const { data: eventRow, error: eventError } = await admin
    .from("calendar_events")
    .select(CALENDAR_EVENT_COLUMNS)
    .eq("id", calendarEventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (eventError) {
    return failure("error", wrapSupabaseError(eventError, "select calendar_events for transcript").message);
  }

  const event = eventRow
    ? mapCalendarEventRow(eventRow as Record<string, unknown>)
    : null;

  if (!event) {
    return failure("not_found", "Scheduled meeting not found.");
  }

  if (getCalendarMeetingLifecycle(event) !== "completed") {
    return failure(
      "not_completed",
      "Transcript fetch is available after the meeting has ended.",
    );
  }

  if (!event.meeting_code?.trim()) {
    return failure("missing_meeting_code", "This event has no Google Meet code to match.");
  }

  try {
    const { accessToken } = await ensureFreshGoogleAccessToken(connection);

    const filter = buildConferenceRecordsFilter({
      meetingCode: event.meeting_code,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
    });

    const conferenceRecords = await listConferenceRecords(accessToken, filter);
    const conference = pickBestConferenceRecord(
      conferenceRecords,
      event.starts_at,
      event.ends_at,
    );

    if (!conference?.name) {
      return failure(
        "not_found",
        "No Google Meet conference record found for this meeting. You may need to be the meeting organizer.",
      );
    }

    const transcripts = await listTranscripts(accessToken, conference.name);
    const transcript = pickReadyTranscript(transcripts);

    if (!transcript?.name) {
      return failure(
        "not_ready",
        "No transcript is available yet for this meeting.",
      );
    }

    if (transcript.state !== "FILE_GENERATED") {
      return failure(
        "not_ready",
        "Transcript is still generating. Try again in a few minutes.",
      );
    }

    const entries = await listTranscriptEntries(accessToken, transcript.name);
    const assembled = assembleMeetTranscriptText(entries);

    if (!assembled) {
      return failure(
        "not_ready",
        "Transcript entries are not available yet. Try again shortly.",
      );
    }

    return {
      success: true,
      transcript: assembled,
      conferenceRecordId: conferenceRecordIdFromName(conference.name),
      entryCount: entries.filter((entry) => entry.text?.trim()).length,
    };
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : null;

    if (status === 401) {
      return failure("needs_reconnect", "Google authorization expired. Reconnect Google to try again.");
    }

    if (status === 403) {
      return failure(
        "forbidden",
        "Google denied access to this transcript. You may need to be the meeting organizer.",
      );
    }

    const message = error instanceof Error ? error.message : "Failed to fetch Google Meet transcript.";
    return failure("error", message);
  }
}
