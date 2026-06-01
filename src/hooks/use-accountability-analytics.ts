import { useQuery } from "@tanstack/react-query";
import { computeAccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import { listAllTaskStatusEvents, listAllTasks } from "@/lib/meetings/api";

export const accountabilityAnalyticsQueryKey = ["accountability-analytics"] as const;

export function useAccountabilityAnalytics() {
  return useQuery({
    queryKey: accountabilityAnalyticsQueryKey,
    queryFn: async () => {
      const [tasks, events] = await Promise.all([listAllTasks(), listAllTaskStatusEvents()]);
      return computeAccountabilityAnalytics(tasks, events);
    },
  });
}
