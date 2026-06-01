import { useQuery } from "@tanstack/react-query";
import { fetchDashboardAnalyticsFn } from "@/lib/dashboard/dashboard-analytics.server";

export const dashboardAnalyticsQueryKey = ["dashboard-analytics"] as const;

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: dashboardAnalyticsQueryKey,
    queryFn: async () => {
      console.info("[dashboard-analytics] client fetch start");
      try {
        const data = await fetchDashboardAnalyticsFn();
        console.info("[dashboard-analytics] client fetch success", {
          totalMeetings: data.totalMeetings,
          pendingTasks: data.pendingTasks,
          overdueTasks: data.overdueTasks,
          completedTasks: data.completedTasks,
          remindersSent: data.remindersSent,
        });
        return data;
      } catch (error) {
        console.error("[dashboard-analytics] client fetch error", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    staleTime: 30_000,
  });
}
