import { useQuery } from "@tanstack/react-query";
import { listCalendarEvents } from "@/lib/calendar/api";

export const calendarEventsQueryKey = ["calendar-events"] as const;

export function useCalendarEvents() {
  return useQuery({
    queryKey: calendarEventsQueryKey,
    queryFn: listCalendarEvents,
    staleTime: 30_000,
  });
}
