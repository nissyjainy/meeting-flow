import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectGoogleCalendarFn,
  getGoogleCalendarConnectionStatusFn,
  syncGoogleCalendarFn,
} from "@/lib/integrations/google/google-calendar.server";
import { calendarEventsQueryKey } from "./use-calendar-events";

export const googleCalendarConnectionQueryKey = ["google-calendar-connection"] as const;

export function useGoogleCalendarConnection() {
  return useQuery({
    queryKey: googleCalendarConnectionQueryKey,
    queryFn: () => getGoogleCalendarConnectionStatusFn(),
    staleTime: 30_000,
  });
}

export function useSyncGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncGoogleCalendarFn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: googleCalendarConnectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: calendarEventsQueryKey });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectGoogleCalendarFn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: googleCalendarConnectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: calendarEventsQueryKey });
    },
  });
}
