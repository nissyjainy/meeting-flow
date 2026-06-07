import { useQuery } from "@tanstack/react-query";
import { listCalendarEventsFn } from "@/lib/calendar/calendar.server";

export const calendarEventsQueryKey = ["calendar-events"] as const;

export function useCalendarEvents() {
  return useQuery({
    queryKey: calendarEventsQueryKey,
    queryFn: () => listCalendarEventsFn(),
    staleTime: 30_000,
  });
}
