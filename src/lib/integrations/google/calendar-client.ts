import { extractCalendarMeetingLink } from "./extract-calendar-meeting-link";
import type { NormalizedGoogleCalendarEvent } from "./types";

type GoogleCalendarAttendee = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
};

type GoogleCalendarEventItem = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: GoogleCalendarAttendee[];
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarEventItem[];
};

function parseGoogleDateTime(value: string | undefined, isAllDayEnd = false): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (isAllDayEnd) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return date.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeGoogleEvent(
  event: GoogleCalendarEventItem,
  calendarId: string,
): NormalizedGoogleCalendarEvent | null {
  const googleEventId = event.id?.trim();
  if (!googleEventId) return null;

  const startsAt = parseGoogleDateTime(event.start?.dateTime ?? event.start?.date);
  const endsAt = parseGoogleDateTime(
    event.end?.dateTime ?? event.end?.date,
    Boolean(event.end?.date && !event.end?.dateTime),
  );

  if (!startsAt || !endsAt) return null;

  const attendees = (event.attendees ?? [])
    .map((attendee) => ({
      email: attendee.email?.trim() ?? "",
      displayName: attendee.displayName?.trim() || null,
      responseStatus: attendee.responseStatus?.trim() || null,
    }))
    .filter((attendee) => attendee.email.length > 0);

  const { meetingUrl, platform } = extractCalendarMeetingLink(event);

  return {
    googleEventId,
    googleCalendarId: calendarId,
    title: event.summary?.trim() || "Untitled meeting",
    startsAt,
    endsAt,
    attendees,
    meetLink: meetingUrl,
    meetingUrl,
    platform,
    cancelled: event.status === "cancelled",
  };
}

export async function fetchUpcomingGoogleCalendarEvents(
  accessToken: string,
  options: { timeMin: string; timeMax: string; calendarId?: string },
): Promise<NormalizedGoogleCalendarEvent[]> {
  const calendarId = encodeURIComponent(options.calendarId ?? "primary");
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: options.timeMin,
    timeMax: options.timeMax,
    maxResults: "250",
    conferenceDataVersion: "1",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar API failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GoogleCalendarListResponse;
  const calendarKey = options.calendarId ?? "primary";

  return (payload.items ?? [])
    .map((item) => normalizeGoogleEvent(item, calendarKey))
    .filter((item): item is NormalizedGoogleCalendarEvent => item !== null);
}
