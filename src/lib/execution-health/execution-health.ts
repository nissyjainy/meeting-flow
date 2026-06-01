import { computeAccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import type { TaskStatusEventRecord } from "@/lib/analytics/task-status-event-record";
import { computeExecutionMetrics } from "@/lib/dashboard/execution-metrics";
import type { DashboardPriorityTask, ExecutionSummary } from "@/lib/dashboard/analytics-types";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { computeTeamInsights, type TeamInsightsSummary } from "@/lib/tasks/team-insights";
import type { AccountabilityAnalytics } from "@/lib/analytics/accountability-analytics";
import { countAtRiskTasks, listAtRiskTasks, type AtRiskTaskRow } from "./at-risk-tasks";
import {
  computeHealthScoreResult,
  computeOverduePercent,
  computeWeekProgress,
  type HealthScoreResult,
} from "./execution-health-score";
import { buildExecutiveSummary } from "./execution-health-summary";

export type ExecutionHealthOverview = {
  healthScore: number;
  healthLabel: HealthScoreResult["label"];
  completionRate: number;
  onTimeCompletionRate: number;
  overduePercent: number;
  openTasks: number;
  completedThisWeek: number;
};

export type ExecutionHealthBundle = {
  overview: ExecutionHealthOverview;
  health: HealthScoreResult;
  accountability: AccountabilityAnalytics;
  teamInsights: TeamInsightsSummary;
  execution: ExecutionSummary;
  topPriorities: DashboardPriorityTask[];
  atRiskTasks: AtRiskTaskRow[];
  atRiskCount: number;
  executiveSummary: string;
};

export function computeExecutionHealthBundle(
  tasks: MeetingTaskRecord[],
  events: TaskStatusEventRecord[],
  referenceDate: Date = new Date(),
): ExecutionHealthBundle {
  const accountability = computeAccountabilityAnalytics(tasks, events, referenceDate);
  const { execution, topPriorities } = computeExecutionMetrics(tasks, referenceDate);
  const teamInsights = computeTeamInsights(tasks, referenceDate);

  const assigned = tasks.length;
  const overduePercent = computeOverduePercent(execution.overdue, assigned);
  const weekProgress = computeWeekProgress(execution.completedThisWeek, assigned);
  const atRiskCount = countAtRiskTasks(tasks, referenceDate);
  const atRiskTasks = listAtRiskTasks(tasks, referenceDate, 10);

  const health = computeHealthScoreResult({
    completionRate: accountability.kpis.completionRate,
    onTimeRate: accountability.kpis.onTimeCompletionRate,
    overduePercent,
    weekProgress,
    openTasks: execution.totalOpen,
    assigned,
    completedThisWeek: execution.completedThisWeek,
    atRiskCount,
  });

  const overview: ExecutionHealthOverview = {
    healthScore: health.score,
    healthLabel: health.label,
    completionRate: accountability.kpis.completionRate,
    onTimeCompletionRate: accountability.kpis.onTimeCompletionRate,
    overduePercent,
    openTasks: execution.totalOpen,
    completedThisWeek: execution.completedThisWeek,
  };

  const executiveSummary = buildExecutiveSummary({
    health,
    completionRate: overview.completionRate,
    overduePercent,
    atRiskCount,
    bestPerformer: accountability.insights.highestCompletionRate,
  });

  return {
    overview,
    health,
    accountability,
    teamInsights,
    execution,
    topPriorities,
    atRiskTasks,
    atRiskCount,
    executiveSummary,
  };
}
