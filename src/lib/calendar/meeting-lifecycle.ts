import type { CalendarEventRecord } from "./types";

export type CalendarMeetingLifecycle = "upcoming" | "in_progress" | "completed" | "cancelled";

export function getCalendarMeetingLifecycle(
  event: Pick<CalendarEventRecord, "status" | "starts_at" | "ends_at">,
  now = new Date(),
): CalendarMeetingLifecycle {
  if (event.status === "cancelled") return "cancelled";

  const startMs = new Date(event.starts_at).getTime();
  const endMs = new Date(event.ends_at).getTime();
  const nowMs = now.getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "upcoming";
  if (nowMs < startMs) return "upcoming";
  if (nowMs < endMs) return "in_progress";
  return "completed";
}

export function calendarLifecycleLabel(status: CalendarMeetingLifecycle): string {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function sortCalendarEventsByLifecyclePriority(
  events: CalendarEventRecord[],
  now = new Date(),
): CalendarEventRecord[] {
  const priority: Record<CalendarMeetingLifecycle, number> = {
    in_progress: 0,
    upcoming: 1,
    completed: 2,
    cancelled: 3,
  };

  return [...events].sort((left, right) => {
    const leftPriority = priority[getCalendarMeetingLifecycle(left, now)];
    const rightPriority = priority[getCalendarMeetingLifecycle(right, now)];
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftStart = new Date(left.starts_at).getTime();
    const rightStart = new Date(right.starts_at).getTime();
    if (leftPriority === "completed") return rightStart - leftStart;
    return leftStart - rightStart;
  });
}
