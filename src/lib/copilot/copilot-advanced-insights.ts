import {
  addDays,
  endOfDay,
  endOfMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { isTaskCompletedStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { resolveDeadlineDate } from "@/lib/reminders/deadline-normalize";
import type { ExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import type { CopilotMeetingSummary } from "./types";

const UNASSIGNED_KEY = "__unassigned__";

export type OwnerTrendInsight = {
  ownerLabel: string;
  delta: number;
  thisMonthCompletions: number;
  lastMonthCompletions: number;
  reason: string;
};

export type ExecutionBottleneck = {
  signal: string;
  detail: string;
  weight: number;
};

export type MeetingTaskRank = {
  meetingId: string;
  meetingTitle: string;
  taskCount: number;
};

export type AtRiskOwnerInsight = {
  ownerLabel: string;
  attentionScore: number;
  overdue: number;
  atRiskCount: number;
  completionRate: number;
  reasons: string[];
};

export type MostAtRiskTaskRow = {
  id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  isOverdue: boolean;
};

export type WeeklyFocusBullet = {
  text: string;
  priority: number;
};

export type WorkloadImbalanceInsight = {
  imbalanceDetected: boolean;
  imbalanceRatio: number;
  meanAssigned: number;
  overloaded: Array<{ ownerLabel: string; assigned: number }>;
  underloaded: Array<{ ownerLabel: string; assigned: number }>;
};

export type CopilotAdvancedInsights = {
  ownerImprovement: OwnerTrendInsight | null;
  ownerDecline: OwnerTrendInsight | null;
  executionBottlenecks: ExecutionBottleneck[];
  meetingsMostTasks: MeetingTaskRank[];
  atRiskOwners: AtRiskOwnerInsight[];
  atRiskTasks: MostAtRiskTaskRow[];
  weeklyFocus: WeeklyFocusBullet[];
  workloadImbalance: WorkloadImbalanceInsight;
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

function parseCompletedAt(task: MeetingTaskRecord): Date | null {
  const raw = task.completed_at?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function countOwnerCompletionsInInterval(
  tasks: MeetingTaskRecord[],
  key: string,
  start: Date,
  end: Date,
): number {
  return tasks.filter((task) => {
    if (ownerKey(task.owner) !== key) return false;
    if (!isTaskCompletedStatus(task.status)) return false;
    const completedAt = parseCompletedAt(task);
    return completedAt != null && isWithinInterval(completedAt, { start, end });
  }).length;
}

function computeOwnerTrends(
  tasks: MeetingTaskRecord[],
  referenceDate: Date,
): { improvement: OwnerTrendInsight | null; decline: OwnerTrendInsight | null } {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const lastMonthStart = startOfMonth(subMonths(referenceDate, 1));
  const lastMonthEnd = endOfMonth(subMonths(referenceDate, 1));

  const ownerKeys = new Set<string>();
  for (const task of tasks) {
    const key = ownerKey(task.owner);
    if (key !== UNASSIGNED_KEY) ownerKeys.add(key);
  }

  let bestImprovement: OwnerTrendInsight | null = null;
  let worstDecline: OwnerTrendInsight | null = null;

  for (const key of ownerKeys) {
    const label = ownerDisplayLabel(
      tasks.find((task) => ownerKey(task.owner) === key)?.owner ?? key,
    );
    const thisMonth = countOwnerCompletionsInInterval(tasks, key, monthStart, monthEnd);
    const lastMonth = countOwnerCompletionsInInterval(tasks, key, lastMonthStart, lastMonthEnd);
    const delta = thisMonth - lastMonth;
    const declineDelta = lastMonth - thisMonth;

    if (
      (thisMonth >= 1 || delta >= 1) &&
      (bestImprovement == null || delta > bestImprovement.delta)
    ) {
      bestImprovement = {
        ownerLabel: label,
        delta,
        thisMonthCompletions: thisMonth,
        lastMonthCompletions: lastMonth,
        reason: `+${delta} completions vs last month (${thisMonth} this month, ${lastMonth} last month)`,
      };
    }

    if (
      declineDelta > 0 &&
      (worstDecline == null || declineDelta > worstDecline.delta)
    ) {
      worstDecline = {
        ownerLabel: label,
        delta: declineDelta,
        thisMonthCompletions: thisMonth,
        lastMonthCompletions: lastMonth,
        reason: `−${declineDelta} completions vs last month (${thisMonth} this month, ${lastMonth} last month)`,
      };
    }
  }

  return { improvement: bestImprovement, decline: worstDecline };
}

function computeExecutionBottlenecks(bundle: ExecutionHealthBundle): ExecutionBottleneck[] {
  const { execution, accountability, teamInsights } = bundle;
  const bottlenecks: ExecutionBottleneck[] = [];

  if (execution.overdue > 0) {
    bottlenecks.push({
      signal: "Overdue workload",
      detail: `${execution.overdue} open task${execution.overdue === 1 ? "" : "s"} past deadline`,
      weight: 10 + execution.overdue,
    });
  }

  const overdueTrend = accountability.charts.overdueTrend;
  if (overdueTrend.length >= 2) {
    const last = overdueTrend[overdueTrend.length - 1]?.value ?? 0;
    const prev = overdueTrend[overdueTrend.length - 2]?.value ?? 0;
    if (last > prev) {
      bottlenecks.push({
        signal: "Rising overdue trend",
        detail: `Overdue count increased from ${prev} to ${last}`,
        weight: 6 + (last - prev),
      });
    }
  }

  const zeroWeekOwners = teamInsights.owners.filter(
    (owner) =>
      owner.ownerKey !== UNASSIGNED_KEY &&
      owner.open > 0 &&
      owner.completed === 0 &&
      bundle.execution.completedThisWeek === 0,
  );
  if (zeroWeekOwners.length > 0 && bundle.execution.completedThisWeek === 0) {
    bottlenecks.push({
      signal: "No completions this week",
      detail: `${zeroWeekOwners.length} owner${zeroWeekOwners.length === 1 ? "" : "s"} with open work and zero team completions this week`,
      weight: 7,
    });
  } else if (bundle.execution.completedThisWeek === 0 && execution.totalOpen > 0) {
    bottlenecks.push({
      signal: "No completions this week",
      detail: "No tasks completed this week despite open workload",
      weight: 7,
    });
  }

  const slowest = accountability.insights.mostDelayedOwner;
  if (slowest) {
    bottlenecks.push({
      signal: "Delayed owner",
      detail: `${slowest.ownerLabel} — ${slowest.metricLabel}: ${slowest.value}`,
      weight: 5 + Number(slowest.value),
    });
  }

  const unassignedOpen = teamInsights.owners.find((row) => row.ownerKey === UNASSIGNED_KEY);
  if (unassignedOpen && unassignedOpen.open > 0) {
    bottlenecks.push({
      signal: "Unassigned open tasks",
      detail: `${unassignedOpen.open} open task${unassignedOpen.open === 1 ? "" : "s"} without an owner`,
      weight: 3 + unassignedOpen.open,
    });
  }

  if (accountability.kpis.completionRate < 60) {
    bottlenecks.push({
      signal: "Low team completion rate",
      detail: `Completion rate is ${accountability.kpis.completionRate}%`,
      weight: 4,
    });
  }

  return [...bottlenecks]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function computeMeetingsMostTasks(meetings: CopilotMeetingSummary[]): MeetingTaskRank[] {
  return [...meetings]
    .filter((meeting) => meeting.taskCount > 0)
    .sort((a, b) => {
      if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 5)
    .map((meeting) => ({
      meetingId: meeting.meetingId,
      meetingTitle: meeting.meetingTitle,
      taskCount: meeting.taskCount,
    }));
}

function listMostAtRiskTasks(
  tasks: MeetingTaskRecord[],
  referenceDate: Date,
  limit = 10,
): MostAtRiskTaskRow[] {
  const today = startOfDay(referenceDate);
  const horizonEnd = endOfDay(addDays(today, 3));

  return tasks
    .filter((task) => !isTaskCompletedStatus(task.status))
    .map((task) => {
      const { date: dueDate } = resolveDeadlineDate(task.deadline, referenceDate);
      const isOverdue = dueDate != null && dueDate < today;
      return { task, dueDate, isOverdue };
    })
    .filter(
      (row): row is { task: MeetingTaskRecord; dueDate: Date; isOverdue: boolean } =>
        row.dueDate != null &&
        (row.isOverdue || (row.dueDate >= today && row.dueDate <= horizonEnd)),
    )
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, limit)
    .map(({ task, isOverdue }) => ({
      id: task.id,
      task: task.task,
      owner: task.owner,
      deadline: task.deadline,
      isOverdue,
    }));
}

function computeAtRiskOwners(
  bundle: ExecutionHealthBundle,
  tasks: MeetingTaskRecord[],
  referenceDate: Date,
): AtRiskOwnerInsight[] {
  const atRiskByOwner = new Map<string, number>();
  for (const row of listMostAtRiskTasks(tasks, referenceDate, 50)) {
    const key = ownerKey(row.owner);
    if (key === UNASSIGNED_KEY) continue;
    atRiskByOwner.set(key, (atRiskByOwner.get(key) ?? 0) + 1);
  }

  const mostDelayed = bundle.accountability.insights.mostDelayedOwner?.ownerLabel.toLowerCase();

  const scored = bundle.teamInsights.owners
    .filter((owner) => owner.ownerKey !== UNASSIGNED_KEY && owner.assigned >= 1)
    .map((owner) => {
      const atRiskCount = atRiskByOwner.get(owner.ownerKey) ?? 0;
      const reasons: string[] = [];
      if (owner.overdue > 0) reasons.push(`${owner.overdue} overdue`);
      if (atRiskCount > 0) reasons.push(`${atRiskCount} at-risk (≤3 days)`);
      if (owner.completionRate < 50 && owner.assigned >= 2) {
        reasons.push(`${owner.completionRate}% completion rate`);
      }
      if (mostDelayed && owner.ownerLabel.toLowerCase() === mostDelayed) {
        reasons.push("most delayed owner");
      }

      const attentionScore =
        owner.overdue * 3 +
        atRiskCount * 2 +
        (owner.completionRate < 50 && owner.assigned >= 2 ? 2 : 0);

      return {
        ownerLabel: owner.ownerLabel,
        attentionScore,
        overdue: owner.overdue,
        atRiskCount,
        completionRate: owner.completionRate,
        reasons,
      };
    })
    .filter((row) => row.attentionScore > 0)
    .sort((a, b) => {
      if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
      return a.ownerLabel.localeCompare(b.ownerLabel);
    })
    .slice(0, 3);

  return scored;
}


function computeWeeklyFocusWithTasks(
  bundle: ExecutionHealthBundle,
  tasks: MeetingTaskRecord[],
  referenceDate: Date,
): WeeklyFocusBullet[] {
  const bullets: WeeklyFocusBullet[] = [];
  const { execution, health, atRiskCount } = bundle;

  if (execution.overdue > 0) {
    bullets.push({
      text: `Clear ${execution.overdue} overdue task${execution.overdue === 1 ? "" : "s"} first`,
      priority: 10,
    });
  }

  const atRiskOwners = computeAtRiskOwners(bundle, tasks, referenceDate);
  const topOwner = atRiskOwners[0];
  if (topOwner && topOwner.atRiskCount > 0) {
    bullets.push({
      text: `Follow up with ${topOwner.ownerLabel} on ${topOwner.atRiskCount} at-risk item${topOwner.atRiskCount === 1 ? "" : "s"}`,
      priority: 9,
    });
  } else if (topOwner && topOwner.overdue > 0) {
    bullets.push({
      text: `Follow up with ${topOwner.ownerLabel} on ${topOwner.overdue} overdue task${topOwner.overdue === 1 ? "" : "s"}`,
      priority: 8,
    });
  }

  if (execution.dueToday > 0) {
    bullets.push({
      text: `Complete ${execution.dueToday} task${execution.dueToday === 1 ? "" : "s"} due today`,
      priority: 7,
    });
  }

  if (atRiskCount > 0 && !topOwner) {
    bullets.push({
      text: `Address ${atRiskCount} task${atRiskCount === 1 ? "" : "s"} at risk in the next 3 days`,
      priority: 8,
    });
  }

  for (const risk of health.risks.slice(0, 2)) {
    bullets.push({ text: risk, priority: 6 });
  }

  for (const strength of health.strengths.slice(0, 1)) {
    bullets.push({ text: `Maintain momentum: ${strength}`, priority: 3 });
  }

  if (bullets.length === 0) {
    bullets.push({
      text: "No urgent risks — keep closing open tasks and maintain weekly completion velocity",
      priority: 1,
    });
  }

  return [...bullets].sort((a, b) => b.priority - a.priority).slice(0, 5);
}

function computeWorkloadImbalance(bundle: ExecutionHealthBundle): WorkloadImbalanceInsight {
  const assignedOwners = bundle.teamInsights.owners.filter(
    (owner) => owner.ownerKey !== UNASSIGNED_KEY && owner.assigned > 0,
  );

  if (assignedOwners.length === 0) {
    return {
      imbalanceDetected: false,
      imbalanceRatio: 0,
      meanAssigned: 0,
      overloaded: [],
      underloaded: [],
    };
  }

  const totalAssigned = assignedOwners.reduce((sum, owner) => sum + owner.assigned, 0);
  const meanAssigned = totalAssigned / assignedOwners.length;
  const maxAssigned = Math.max(...assignedOwners.map((owner) => owner.assigned));
  const imbalanceRatio = meanAssigned > 0 ? maxAssigned / meanAssigned : 0;
  const threshold = meanAssigned * 1.5;

  const overloaded = assignedOwners
    .filter((owner) => owner.assigned > threshold)
    .map((owner) => ({ ownerLabel: owner.ownerLabel, assigned: owner.assigned }))
    .sort((a, b) => b.assigned - a.assigned);

  const underloaded = assignedOwners
    .filter((owner) => owner.assigned < meanAssigned)
    .map((owner) => ({ ownerLabel: owner.ownerLabel, assigned: owner.assigned }))
    .sort((a, b) => a.assigned - b.assigned);

  return {
    imbalanceDetected: imbalanceRatio >= 2 || overloaded.length > 0,
    imbalanceRatio: Math.round(imbalanceRatio * 10) / 10,
    meanAssigned: Math.round(meanAssigned * 10) / 10,
    overloaded,
    underloaded,
  };
}

export function computeCopilotAdvancedInsights(input: {
  bundle: ExecutionHealthBundle;
  meetings: CopilotMeetingSummary[];
  tasks: MeetingTaskRecord[];
  referenceDate?: Date;
}): CopilotAdvancedInsights {
  const referenceDate = input.referenceDate ?? new Date();
  const { improvement, decline } = computeOwnerTrends(input.tasks, referenceDate);

  return {
    ownerImprovement: improvement,
    ownerDecline: decline,
    executionBottlenecks: computeExecutionBottlenecks(input.bundle),
    meetingsMostTasks: computeMeetingsMostTasks(input.meetings),
    atRiskOwners: computeAtRiskOwners(input.bundle, input.tasks, referenceDate),
    atRiskTasks: listMostAtRiskTasks(input.tasks, referenceDate, 10),
    weeklyFocus: computeWeeklyFocusWithTasks(input.bundle, input.tasks, referenceDate),
    workloadImbalance: computeWorkloadImbalance(input.bundle),
  };
}
