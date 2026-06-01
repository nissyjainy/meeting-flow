import {
  addDays,
  addWeeks,
  differenceInHours,
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { TaskStatusEventRecord } from "@/lib/analytics/task-status-event-record";
import { resolveDeadlineDate } from "@/lib/reminders/deadline-normalize";
import { isTaskCompletedStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";

export type AccountabilityKpis = {
  completionRate: number;
  onTimeCompletionRate: number;
  averageCompletionHours: number | null;
  tasksCompletedThisMonth: number;
};

export type OwnerInsightHighlight = {
  ownerLabel: string;
  metricLabel: string;
  value: string;
};

export type WeeklyTrendPoint = {
  week: string;
  value: number;
};

export type AccountabilityAnalytics = {
  kpis: AccountabilityKpis;
  insights: {
    mostReliableOwner: OwnerInsightHighlight | null;
    mostDelayedOwner: OwnerInsightHighlight | null;
    fastestCompleter: OwnerInsightHighlight | null;
    highestCompletionRate: OwnerInsightHighlight | null;
  };
  charts: {
    weeklyCompletions: WeeklyTrendPoint[];
    overdueTrend: WeeklyTrendPoint[];
    taskVolumeTrend: WeeklyTrendPoint[];
  };
};

const UNASSIGNED_KEY = "__unassigned__";
const TREND_WEEKS = 8;

type TaskContext = {
  task: MeetingTaskRecord;
  completedAt: Date | null;
  startedAt: Date | null;
  deadlineDate: Date | null;
};

type OwnerStats = {
  ownerKey: string;
  ownerLabel: string;
  assigned: number;
  completed: number;
  onTimeCompleted: number;
  completedWithDeadline: number;
  completionDurationsHours: number[];
  delayScore: number;
};

type WeekRange = {
  label: string;
  start: Date;
  end: Date;
};

function ownerKey(owner: string | null | undefined): string {
  const trimmed = owner?.trim();
  if (!trimmed) return UNASSIGNED_KEY;
  return trimmed.toLowerCase();
}

function ownerDisplayLabel(owner: string | null | undefined): string {
  const trimmed = owner?.trim();
  if (!trimmed) return "Unassigned";
  return trimmed;
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventsForTask(events: TaskStatusEventRecord[], taskId: string): TaskStatusEventRecord[] {
  return events
    .filter((event) => event.task_id === taskId)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
}

function resolveStartedAt(
  task: MeetingTaskRecord,
  taskEvents: TaskStatusEventRecord[],
): Date | null {
  const fromTask = parseTimestamp(task.started_at);
  if (fromTask) return fromTask;

  const startEvent = taskEvents.find((event) => event.to_status === "in_progress");
  return startEvent ? parseTimestamp(startEvent.occurred_at) : null;
}

function resolveCompletedAt(
  task: MeetingTaskRecord,
  taskEvents: TaskStatusEventRecord[],
): Date | null {
  const fromTask = parseTimestamp(task.completed_at);
  if (fromTask) return fromTask;

  const completionEvent = taskEvents.find((event) => event.to_status === "completed");
  if (completionEvent) return parseTimestamp(completionEvent.occurred_at);

  if (isTaskCompletedStatus(task.status)) {
    return parseTimestamp(task.updated_at) ?? parseTimestamp(task.created_at);
  }

  return null;
}

function buildTaskContexts(
  tasks: MeetingTaskRecord[],
  events: TaskStatusEventRecord[],
  referenceDate: Date,
): TaskContext[] {
  const eventsByTask = new Map<string, TaskStatusEventRecord[]>();
  for (const event of events) {
    const list = eventsByTask.get(event.task_id) ?? [];
    list.push(event);
    eventsByTask.set(event.task_id, list);
  }

  return tasks.map((task) => {
    const taskEvents = eventsForTask(eventsByTask.get(task.id) ?? [], task.id);
    const deadlineDate = resolveDeadlineDate(task.deadline, referenceDate).date;
    return {
      task,
      completedAt: resolveCompletedAt(task, taskEvents),
      startedAt: resolveStartedAt(task, taskEvents),
      deadlineDate,
    };
  });
}

function isOnTimeCompletion(completedAt: Date, deadlineDate: Date): boolean {
  return completedAt.getTime() <= endOfDay(deadlineDate).getTime();
}

function formatDurationHours(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h avg`;
  return `${(hours / 24).toFixed(1)}d avg`;
}

function buildWeekRanges(referenceDate: Date, weeks: number): WeekRange[] {
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, index) => {
    const start = addWeeks(currentWeekStart, index - (weeks - 1));
    const end = endOfDay(addDays(start, 6));
    return {
      start,
      end,
      label: format(start, "MMM d"),
    };
  });
}

function buildOwnerStats(contexts: TaskContext[], referenceDate: Date): Map<string, OwnerStats> {
  const stats = new Map<string, OwnerStats>();

  for (const ctx of contexts) {
    const key = ownerKey(ctx.task.owner);
    const label = ownerDisplayLabel(ctx.task.owner);
    const row =
      stats.get(key) ??
      ({
        ownerKey: key,
        ownerLabel: label,
        assigned: 0,
        completed: 0,
        onTimeCompleted: 0,
        completedWithDeadline: 0,
        completionDurationsHours: [],
        delayScore: 0,
      } satisfies OwnerStats);

    row.assigned += 1;

    if (ctx.completedAt) {
      row.completed += 1;

      if (ctx.startedAt && ctx.completedAt >= ctx.startedAt) {
        row.completionDurationsHours.push(differenceInHours(ctx.completedAt, ctx.startedAt));
      }

      if (ctx.deadlineDate) {
        row.completedWithDeadline += 1;
        if (isOnTimeCompletion(ctx.completedAt, ctx.deadlineDate)) {
          row.onTimeCompleted += 1;
        } else {
          row.delayScore += 1;
        }
      }
    } else if (ctx.deadlineDate && endOfDay(ctx.deadlineDate) < referenceDate) {
      row.delayScore += 1;
    }

    stats.set(key, row);
  }

  return stats;
}

function computeKpis(contexts: TaskContext[], referenceDate: Date): AccountabilityKpis {
  const assigned = contexts.length;
  const completedContexts = contexts.filter((ctx) => ctx.completedAt);
  const completed = completedContexts.length;

  const withDeadline = completedContexts.filter((ctx) => ctx.deadlineDate);
  const onTime = withDeadline.filter(
    (ctx) => ctx.completedAt && ctx.deadlineDate && isOnTimeCompletion(ctx.completedAt, ctx.deadlineDate),
  ).length;

  const withDuration = completedContexts.filter(
    (ctx) => ctx.startedAt && ctx.completedAt && ctx.completedAt >= ctx.startedAt,
  );
  const totalHours = withDuration.reduce(
    (sum, ctx) => sum + differenceInHours(ctx.completedAt!, ctx.startedAt!),
    0,
  );

  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const completedThisMonth = completedContexts.filter(
    (ctx) => ctx.completedAt && isWithinInterval(ctx.completedAt, { start: monthStart, end: monthEnd }),
  ).length;

  return {
    completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
    onTimeCompletionRate:
      withDeadline.length > 0 ? Math.round((onTime / withDeadline.length) * 100) : 0,
    averageCompletionHours:
      withDuration.length > 0 ? Math.round((totalHours / withDuration.length) * 10) / 10 : null,
    tasksCompletedThisMonth: completedThisMonth,
  };
}

function pickOwnerInsight(
  owners: OwnerStats[],
  pick: (owners: OwnerStats[]) => OwnerStats | null,
  metricLabel: string,
  formatValue: (owner: OwnerStats) => string,
): OwnerInsightHighlight | null {
  const selected = pick(owners);
  if (!selected) return null;
  return {
    ownerLabel: selected.ownerLabel,
    metricLabel,
    value: formatValue(selected),
  };
}

function computeInsights(ownerStats: Map<string, OwnerStats>): AccountabilityAnalytics["insights"] {
  const owners = [...ownerStats.values()].filter((o) => o.ownerKey !== UNASSIGNED_KEY);

  return {
    mostReliableOwner: pickOwnerInsight(
      owners,
      (rows) =>
        [...rows]
          .filter((r) => r.completedWithDeadline > 0)
          .sort((a, b) => {
            const aRate = a.onTimeCompleted / a.completedWithDeadline;
            const bRate = b.onTimeCompleted / b.completedWithDeadline;
            if (bRate !== aRate) return bRate - aRate;
            return b.completedWithDeadline - a.completedWithDeadline;
          })[0] ?? null,
      "On-time rate",
      (o) => `${Math.round((o.onTimeCompleted / o.completedWithDeadline) * 100)}%`,
    ),
    mostDelayedOwner: pickOwnerInsight(
      owners,
      (rows) =>
        [...rows]
          .filter((r) => r.delayScore > 0)
          .sort((a, b) => b.delayScore - a.delayScore || b.assigned - a.assigned)[0] ?? null,
      "Delayed tasks",
      (o) => `${o.delayScore}`,
    ),
    fastestCompleter: pickOwnerInsight(
      owners,
      (rows) =>
        [...rows]
          .filter((r) => r.completionDurationsHours.length > 0)
          .sort((a, b) => {
            const aAvg =
              a.completionDurationsHours.reduce((s, v) => s + v, 0) / a.completionDurationsHours.length;
            const bAvg =
              b.completionDurationsHours.reduce((s, v) => s + v, 0) / b.completionDurationsHours.length;
            return aAvg - bAvg;
          })[0] ?? null,
      "Avg completion time",
      (o) => {
        const avg =
          o.completionDurationsHours.reduce((s, v) => s + v, 0) / o.completionDurationsHours.length;
        return formatDurationHours(avg);
      },
    ),
    highestCompletionRate: pickOwnerInsight(
      owners,
      (rows) =>
        [...rows]
          .filter((r) => r.assigned > 0)
          .sort((a, b) => {
            const aRate = a.completed / a.assigned;
            const bRate = b.completed / b.assigned;
            if (bRate !== aRate) return bRate - aRate;
            return b.completed - a.completed;
          })[0] ?? null,
      "Completion rate",
      (o) => `${Math.round((o.completed / o.assigned) * 100)}%`,
    ),
  };
}

function computeWeeklyCompletions(
  contexts: TaskContext[],
  referenceDate: Date,
): WeeklyTrendPoint[] {
  const ranges = buildWeekRanges(referenceDate, TREND_WEEKS);
  return ranges.map((range) => ({
    week: range.label,
    value: contexts.filter(
      (ctx) =>
        ctx.completedAt &&
        isWithinInterval(ctx.completedAt, { start: range.start, end: range.end }),
    ).length,
  }));
}

function computeOverdueTrend(
  contexts: TaskContext[],
  referenceDate: Date,
): WeeklyTrendPoint[] {
  const ranges = buildWeekRanges(referenceDate, TREND_WEEKS);
  return ranges.map((range) => ({
    week: range.label,
    value: contexts.filter((ctx) => {
      if (!ctx.deadlineDate) return false;
      if (endOfDay(ctx.deadlineDate) > range.end) return false;
      if (!ctx.completedAt) return true;
      return ctx.completedAt > range.end;
    }).length,
  }));
}

function computeTaskVolumeTrend(
  contexts: TaskContext[],
  referenceDate: Date,
): WeeklyTrendPoint[] {
  const ranges = buildWeekRanges(referenceDate, TREND_WEEKS);
  return ranges.map((range) => ({
    week: range.label,
    value: contexts.filter((ctx) => {
      const created = parseTimestamp(ctx.task.created_at);
      return created && isWithinInterval(created, { start: range.start, end: range.end });
    }).length,
  }));
}

export function computeAccountabilityAnalytics(
  tasks: MeetingTaskRecord[],
  events: TaskStatusEventRecord[],
  referenceDate: Date = new Date(),
): AccountabilityAnalytics {
  const contexts = buildTaskContexts(tasks, events, referenceDate);
  const ownerStats = buildOwnerStats(contexts, referenceDate);

  return {
    kpis: computeKpis(contexts, referenceDate),
    insights: computeInsights(ownerStats),
    charts: {
      weeklyCompletions: computeWeeklyCompletions(contexts, referenceDate),
      overdueTrend: computeOverdueTrend(contexts, referenceDate),
      taskVolumeTrend: computeTaskVolumeTrend(contexts, referenceDate),
    },
  };
}

export function formatAverageCompletionTime(hours: number | null): string {
  if (hours == null) return "—";
  return formatDurationHours(hours);
}
