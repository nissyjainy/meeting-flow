import { useQuery } from "@tanstack/react-query";
import { getMeeting, getMeetingSignedUrl } from "@/lib/meetings/api";
import { getPipelineDisplayStatus } from "@/lib/meetings/meeting-display";

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getMeeting(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const meeting = query.state.data;
      if (!meeting) return false;
      return getPipelineDisplayStatus(meeting) === "processing" ? 5000 : false;
    },
  });
}

export function useMeetingPlaybackUrl(fileUrl: string | undefined) {
  return useQuery({
    queryKey: ["meeting-playback", fileUrl],
    queryFn: () => getMeetingSignedUrl(fileUrl!),
    enabled: Boolean(fileUrl),
    staleTime: 50 * 60 * 1000,
  });
}
