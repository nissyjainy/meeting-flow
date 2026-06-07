import { createClient } from "@/lib/supabase/client";
import type { CalendarAttendee, CalendarEventRecord } from "./types";

export const CALENDAR_EVENT_COLUMNS =
  "id,user_id,google_event_id,google_calendar_id,title,organizer_email,organizer_name,starts_at,ends_at,attendees,meet_link,platform,meeting_url,meeting_code,google_conference_id,capture_status,transcript_status,status,linked_meeting_id,synced_at,created_at,updated_at";

const MEETING_PLATFORMS = new Set(["Zoom", "Google Meet", "Microsoft Teams", "Unknown"]);

function mapMeetingPlatform(value: unknown): CalendarEventRecord["platform"] {
  if (typeof value !== "string" || !MEETING_PLATFORMS.has(value)) return null;
  return value as CalendarEventRecord["platform"];
}

function mapAttendees(value: unknown): CalendarAttendee[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!email) return null;

      return {
        email,
        displayName: typeof row.displayName === "string" ? row.displayName : null,
        responseStatus: typeof row.responseStatus === "string" ? row.responseStatus : null,
      };
    })
    .filter((item): item is CalendarAttendee => item !== null);
}

export function mapCalendarEventRow(row: Record<string, unknown>): CalendarEventRecord | null {
  const id = row.id != null ? String(row.id) : "";
  const title = row.title != null ? String(row.title).trim() : "";
  if (!id || !title) return null;

  const meetingUrl =
    row.meeting_url != null
      ? String(row.meeting_url)
      : row.meet_link != null
        ? String(row.meet_link)
        : null;

  const captureStatus = row.capture_status;
  const transcriptStatus = row.transcript_status;

  return {
    id,
    user_id: String(row.user_id),
    google_event_id: String(row.google_event_id),
    google_calendar_id: String(row.google_calendar_id ?? "primary"),
    title,
    organizer_email: row.organizer_email != null ? String(row.organizer_email) : null,
    organizer_name: row.organizer_name != null ? String(row.organizer_name) : null,
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    attendees: mapAttendees(row.attendees),
    meet_link: meetingUrl,
    platform: mapMeetingPlatform(row.platform),
    meeting_url: meetingUrl,
    meeting_code: row.meeting_code != null ? String(row.meeting_code) : null,
    google_conference_id:
      row.google_conference_id != null ? String(row.google_conference_id) : null,
    capture_status:
      captureStatus === "pending_capture" ||
      captureStatus === "capturing" ||
      captureStatus === "captured" ||
      captureStatus === "failed"
        ? captureStatus
        : "discovered",
    transcript_status:
      transcriptStatus === "queued" ||
      transcriptStatus === "processing" ||
      transcriptStatus === "completed" ||
      transcriptStatus === "failed"
        ? transcriptStatus
        : "not_started",
    status: row.status === "cancelled" ? "cancelled" : "scheduled",
    linked_meeting_id: row.linked_meeting_id != null ? String(row.linked_meeting_id) : null,
    synced_at: String(row.synced_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listCalendarEvents(): Promise<CalendarEventRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(CALENDAR_EVENT_COLUMNS)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapCalendarEventRow(row as Record<string, unknown>))
    .filter((row): row is CalendarEventRecord => row !== null);
}

export async function getCalendarEvent(id: string): Promise<CalendarEventRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(CALENDAR_EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapCalendarEventRow(data as Record<string, unknown>);
}
