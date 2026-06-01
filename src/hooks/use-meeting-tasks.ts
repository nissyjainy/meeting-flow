import { useQuery } from "@tanstack/react-query";
import { listMeetingTasks } from "@/lib/meetings/api";

export function useMeetingTasks(meetingId: string, options?: { pollWhileProcessing?: boolean }) {
  return useQuery({
    queryKey: ["meeting-tasks", meetingId],
    queryFn: () => listMeetingTasks(meetingId),
    enabled: Boolean(meetingId),
    refetchInterval: options?.pollWhileProcessing ? 5000 : false,
  });
}
