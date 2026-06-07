import { Badge } from "@/components/ui/badge";
import {
  calendarLifecycleLabel,
  getCalendarMeetingLifecycle,
  type CalendarMeetingLifecycle,
} from "@/lib/calendar/meeting-lifecycle";
import type { CalendarEventRecord } from "@/lib/calendar/types";

function lifecycleBadgeClass(status: CalendarMeetingLifecycle): string {
  switch (status) {
    case "upcoming":
      return "bg-primary/10 text-primary hover:bg-primary/10";
    case "in_progress":
      return "bg-warning/15 text-warning hover:bg-warning/15";
    case "completed":
      return "bg-muted text-muted-foreground hover:bg-muted";
    case "cancelled":
      return "bg-destructive/10 text-destructive hover:bg-destructive/10";
  }
}

export function CalendarLifecycleBadge({
  event,
  now,
}: {
  event: Pick<CalendarEventRecord, "status" | "starts_at" | "ends_at">;
  now?: Date;
}) {
  const lifecycle = getCalendarMeetingLifecycle(event, now);

  return (
    <Badge className={`shrink-0 gap-1 ${lifecycleBadgeClass(lifecycle)}`}>
      {calendarLifecycleLabel(lifecycle)}
    </Badge>
  );
}
