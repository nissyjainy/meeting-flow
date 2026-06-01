import type { MeetingRecord } from "@/lib/meetings/types";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";
import type { CalendarEventRecord, MeetingFilter, MeetingsListItem } from "./types";

export function buildMeetingsListItems(
  uploads: MeetingRecord[],
  calendarEvents: CalendarEventRecord[],
): MeetingsListItem[] {
  const uploadItems: MeetingsListItem[] = uploads.map((meeting) => ({
    kind: "upload",
    meeting,
    sortAt: meeting.created_at,
  }));

  const scheduledItems: MeetingsListItem[] = calendarEvents
    .filter((event) => event.status === "scheduled")
    .map((event) => ({
      kind: "scheduled",
      event,
      sortAt: event.starts_at,
    }));

  return [...uploadItems, ...scheduledItems].sort(
    (left, right) => new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime(),
  );
}

export function listItemMatchesSearch(item: MeetingsListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  if (item.kind === "upload") {
    return (
      item.meeting.title.toLowerCase().includes(normalized) ||
      item.meeting.file_name.toLowerCase().includes(normalized) ||
      (item.meeting.summary?.toLowerCase().includes(normalized) ?? false)
    );
  }

  const attendeeMatch = item.event.attendees.some(
    (attendee) =>
      attendee.email.toLowerCase().includes(normalized) ||
      (attendee.displayName?.toLowerCase().includes(normalized) ?? false),
  );

  return item.event.title.toLowerCase().includes(normalized) || attendeeMatch;
}

export function listItemMatchesFilter(item: MeetingsListItem, filter: MeetingFilter): boolean {
  if (filter === "all") return true;

  if (filter === "scheduled") {
    return item.kind === "scheduled" && isUpcomingScheduledEvent(item.event);
  }

  if (item.kind === "scheduled") return false;

  const pipeline = getPipelineDisplayStatus(item.meeting);
  if (filter === "ready") return pipeline === "completed";
  if (filter === "processing") return pipeline === "processing";
  return true;
}

export function isUpcomingScheduledEvent(event: CalendarEventRecord, now = new Date()): boolean {
  if (event.status !== "scheduled") return false;
  return new Date(event.ends_at).getTime() >= now.getTime();
}

export function formatScheduledRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} – ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
}
