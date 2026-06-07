import { useQuery } from "@tanstack/react-query";
import { getCalendarEventFn } from "@/lib/calendar/calendar.server";

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: ["calendar-event", id],
    queryFn: () => getCalendarEventFn({ data: { id } }),
    enabled: Boolean(id),
  });
}
