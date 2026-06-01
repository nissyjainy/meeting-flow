import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMeeting, listMeetings } from "@/lib/meetings/api";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";

export const meetingsQueryKey = ["meetings"] as const;

export function useMeetings() {
  return useQuery({
    queryKey: meetingsQueryKey,
    queryFn: listMeetings,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const meetings = query.state.data;
      if (!meetings?.some((m) => getPipelineDisplayStatus(m) === "processing")) {
        return false;
      }
      return 5000;
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
    },
  });
}
