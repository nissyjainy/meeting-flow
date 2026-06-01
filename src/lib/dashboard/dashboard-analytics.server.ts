import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDashboardAnalyticsFromDataset,
  countDashboardReminderSends,
  emptyDashboardAnalytics,
  fetchDashboardMeetingRows,
  fetchDashboardTaskRows,
} from "./dashboard-dataset.server";
import type { DashboardAnalytics } from "./analytics-types";

export const fetchDashboardAnalyticsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<DashboardAnalytics> => {
    console.info("[dashboard-analytics] fetch start");

    try {
      const supabase = getSupabaseServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.info("[dashboard-analytics] auth context", {
        userId: user?.id ?? null,
        authenticated: Boolean(user),
        authError: authError?.message ?? null,
      });

      const [meetings, tasks, remindersSent] = await Promise.all([
        fetchDashboardMeetingRows(supabase),
        fetchDashboardTaskRows(supabase),
        countDashboardReminderSends(supabase),
      ]);

      const analytics = buildDashboardAnalyticsFromDataset(meetings, tasks, remindersSent);

      console.info("[dashboard-analytics] dataset built", {
        totalMeetings: analytics.totalMeetings,
        pendingTasks: analytics.pendingTasks,
        overdueTasks: analytics.overdueTasks,
        completedTasks: analytics.completedTasks,
        remindersSent: analytics.remindersSent,
        execution: analytics.execution,
        topPriorities: analytics.topPriorities.length,
        recentMeetings: analytics.recentMeetings.length,
      });

      console.info("[dashboard-analytics] fetch success");
      return analytics;
    } catch (error) {
      console.error("[dashboard-analytics] fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return emptyDashboardAnalytics();
    }
  },
);
