import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMeetingTaskStatus } from "@/lib/meetings/api";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import type { StoredTaskStatus } from "@/lib/meetings/task-status";
import { allTasksQueryKey } from "@/hooks/use-all-tasks";
import { dashboardAnalyticsQueryKey } from "@/hooks/use-dashboard-analytics";

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: StoredTaskStatus }) =>
      updateMeetingTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: allTasksQueryKey });

      const previous = queryClient.getQueryData<MeetingTaskRecord[]>(allTasksQueryKey);

      queryClient.setQueryData<MeetingTaskRecord[]>(allTasksQueryKey, (current) =>
        (current ?? []).map((task) => (task.id === taskId ? { ...task, status } : task)),
      );

      return { previous };
    },
    onSuccess: (record, { taskId }) => {
      queryClient.setQueryData<MeetingTaskRecord[]>(allTasksQueryKey, (current) =>
        (current ?? []).map((task) => (task.id === taskId ? record : task)),
      );

      void queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
      void queryClient.invalidateQueries({ queryKey: dashboardAnalyticsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["meeting-tasks", record.meeting_id] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(allTasksQueryKey, context.previous);
      }
    },
  });
}
