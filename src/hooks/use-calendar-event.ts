import { useQuery } from "@tanstack/react-query";
import { getCalendarEvent } from "@/lib/calendar/api";

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: ["calendar-event", id],
    queryFn: () => getCalendarEvent(id),
    enabled: Boolean(id),
  });
}
