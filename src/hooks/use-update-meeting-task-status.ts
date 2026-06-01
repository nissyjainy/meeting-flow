import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMeetingTaskStatus } from "@/lib/meetings/api";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import type { StoredTaskStatus } from "@/lib/meetings/task-status";
import { dashboardAnalyticsQueryKey } from "@/hooks/use-dashboard-analytics";

export function useUpdateMeetingTaskStatus(meetingId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["meeting-tasks", meetingId] as const;

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: StoredTaskStatus }) =>
      updateMeetingTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      console.info("[task-status] optimistic update", { taskId, status, meetingId });

      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<MeetingTaskRecord[]>(queryKey);

      queryClient.setQueryData<MeetingTaskRecord[]>(queryKey, (current) =>
        (current ?? []).map((task) => (task.id === taskId ? { ...task, status } : task)),
      );

      return { previous };
    },
    onSuccess: (record, { taskId, status }) => {
      console.info("[task-status] mutation success — cache updated, refreshing dashboard stats", {
        taskId,
        meetingId,
        requestedStatus: status,
        persistedStatus: record.status,
        persistedInSupabase: record.status === status,
      });

      queryClient.setQueryData<MeetingTaskRecord[]>(queryKey, (current) =>
        (current ?? []).map((task) => (task.id === taskId ? record : task)),
      );

      void queryClient.invalidateQueries({ queryKey: dashboardAnalyticsQueryKey });
    },
    onError: (error, { taskId, status }, context) => {
      console.error("[task-status] mutation failed — rolling back cache", {
        taskId,
        meetingId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });

      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
