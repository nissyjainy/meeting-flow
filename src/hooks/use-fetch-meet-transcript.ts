import { useMutation } from "@tanstack/react-query";
import { fetchMeetTranscriptFn } from "@/lib/integrations/google/google-calendar.server";
import type { MeetTranscriptFetchResult } from "@/lib/integrations/google/meet-transcript.types";

export function useFetchMeetTranscript() {
  return useMutation({
    mutationFn: async (calendarEventId: string): Promise<MeetTranscriptFetchResult> =>
      fetchMeetTranscriptFn({ data: { calendarEventId } }),
  });
}
