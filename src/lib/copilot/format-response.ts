import {
  isTaskCompletedStatus,
  TASK_STATUS_LABELS,
  type DisplayTaskStatus,
  type StoredTaskStatus,
} from "@/lib/meetings/task-status";
import {
  formatAverageCompletionTime as formatAverageCompletionTimeLabel,
  type AccountabilityAnalytics,
} from "@/lib/analytics/accountability-analytics";
import { classifyReminderTask } from "@/lib/reminders/task-reminder-classify";
import type { MeetingReference } from "@/lib/reminders/task-reminder-types";
import { getReminderConfig } from "@/lib/reminders/reminder-env";
import type {
  CopilotIntent,
  CopilotMeetingContext,
  CopilotTaskContext,
  CopilotWorkspaceContext,
} from "./types";
import { formatAdvancedCopilotResponse } from "./format-advanced-insights";

function formatDeadline(deadline: string | null): string {
  if (!deadline?.trim()) return "No deadline";
  const trimmed = deadline.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return trimmed;
}

function formatSentAt(sentAt: string): string {
  const parsed = new Date(sentAt);
  if (Number.isNaN(parsed.getTime())) return sentAt;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: DisplayTaskStatus): string {
  return TASK_STATUS_LABELS[status];
}

function formatTaskLine(task: CopilotTaskContext): string {
  const meeting = task.meetingTitle ? ` · ${task.meetingTitle}` : "";
  return `• ${task.task}${meeting} · Owner: ${task.owner?.trim() || "Unassigned"} · Due: ${formatDeadline(task.deadline)} · ${statusLabel(task.status)}`;
}

function formatWorkspaceTaskLine(task: CopilotTaskContext): string {
  const meeting = task.meetingTitle ?? "Unknown meeting";
  return `• ${task.task} · ${meeting} · Owner: ${task.owner?.trim() || "Unassigned"} · Due: ${formatDeadline(task.deadline)} · ${statusLabel(task.status)}`;
}

function isOpenTask(task: CopilotTaskContext): boolean {
  return !isTaskCompletedStatus(task.storedStatus as StoredTaskStatus);
}

function filterTasksForScope(
  tasks: CopilotTaskContext[],
  meetingId: string | null | undefined,
): CopilotTaskContext[] {
  if (!meetingId) return tasks;
  return tasks.filter((task) => task.meetingId === meetingId);
}

function scopeLabel(workspace: CopilotWorkspaceContext, meetingId: string | null | undefined): string {
  if (!meetingId) return "your workspace";
  const meeting = workspace.meetings.find((row) => row.meetingId === meetingId);
  return meeting?.meetingTitle ?? "this meeting";
}

function formatMeetingSummary(context: CopilotMeetingContext): string {
  if (context.pipelineStatus === "none") {
    return "No meetings found yet. Upload a recording to generate a summary.";
  }

  if (context.pipelineStatus === "processing") {
    return `${context.meetingTitle} is still processing. The summary will appear when transcription and AI analysis finish.`;
  }

  if (context.pipelineStatus === "failed") {
    return `Summary could not be generated for ${context.meetingTitle}. The transcript may still be available on the meeting page.`;
  }

  if (!context.summary?.trim()) {
    return `No summary is available yet for ${context.meetingTitle}.`;
  }

  return `${context.meetingTitle}\n\n${context.summary.trim()}`;
}

function formatExtractedTasks(context: CopilotMeetingContext): string {
  if (context.tasks.length === 0) {
    return context.meetingId
      ? `No action items were extracted for ${context.meetingTitle}.`
      : "No action items found across your meetings.";
  }

  const header = context.meetingId
    ? `${context.tasks.length} action item${context.tasks.length === 1 ? "" : "s"} for ${context.meetingTitle}:`
    : `${context.tasks.length} action item${context.tasks.length === 1 ? "" : "s"} across recent meetings:`;

  return `${header}\n\n${context.tasks.map(formatTaskLine).join("\n")}`;
}

function formatTaskOwners(context: CopilotMeetingContext): string {
  if (context.tasks.length === 0) {
    return "No tasks with owners to show yet.";
  }

  const lines = context.tasks.map((task) => {
    const owner = task.owner?.trim() || "Unassigned";
    const email = task.ownerEmail ? ` · ${task.ownerEmail}` : "";
    return `• ${task.task} → ${owner}${email}`;
  });

  return `Task owners for ${context.meetingTitle}:\n\n${lines.join("\n")}`;
}

function formatTaskDeadlines(context: CopilotMeetingContext): string {
  if (context.tasks.length === 0) {
    return "No tasks with deadlines to show yet.";
  }

  const sorted = [...context.tasks].sort((a, b) => {
    const aOverdue = a.status === "overdue" ? 0 : 1;
    const bOverdue = b.status === "overdue" ? 0 : 1;
    return aOverdue - bOverdue;
  });

  const lines = sorted.map(
    (task) => `• ${task.task} · ${formatDeadline(task.deadline)} · ${statusLabel(task.status)}`,
  );

  return `Deadlines for ${context.meetingTitle}:\n\n${lines.join("\n")}`;
}

function formatReminderStatus(context: CopilotMeetingContext): string {
  const eligible = context.tasks.filter((task) => task.status !== "completed");
  const counts = {
    overdue: 0,
    sameDay: 0,
    upcoming: 0,
    pending: 0,
  };

  for (const task of eligible) {
    if (task.reminderCategory === "overdue") counts.overdue += 1;
    else if (task.reminderCategory === "sameDay") counts.sameDay += 1;
    else if (task.reminderCategory === "upcoming") counts.upcoming += 1;
    else counts.pending += 1;
  }

  const scope = context.meetingId ? context.meetingTitle : "your workspace";

  return [
    `Reminder status for ${scope}:`,
    `• Emails sent: ${context.remindersSent}`,
    `• Tasks eligible for reminders: ${eligible.length}`,
    `• Overdue: ${counts.overdue}`,
    `• Due today: ${counts.sameDay}`,
    `• Upcoming: ${counts.upcoming}`,
    `• Pending (no urgent deadline): ${counts.pending}`,
    "",
    "Completed tasks are excluded from reminder emails.",
  ].join("\n");
}

function formatPendingTasks(
  workspace: CopilotWorkspaceContext,
  meetingId?: string | null,
): string {
  const scopedTasks = filterTasksForScope(workspace.tasks, meetingId);
  const pending = scopedTasks.filter(isOpenTask);
  const scope = scopeLabel(workspace, meetingId);

  if (pending.length === 0) {
    return `No pending tasks in ${scope}.`;
  }

  return [
    `${pending.length} pending task${pending.length === 1 ? "" : "s"} in ${scope}:`,
    "",
    pending.map(formatWorkspaceTaskLine).join("\n"),
  ].join("\n");
}

function formatOverdueTasks(
  workspace: CopilotWorkspaceContext,
  meetingId?: string | null,
): string {
  const scopedTasks = filterTasksForScope(workspace.tasks, meetingId);
  const overdue = scopedTasks.filter((task) => task.status === "overdue");
  const scope = scopeLabel(workspace, meetingId);

  if (overdue.length === 0) {
    return `No overdue tasks in ${scope}.`;
  }

  return [
    `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} in ${scope}:`,
    "",
    overdue.map(formatWorkspaceTaskLine).join("\n"),
  ].join("\n");
}

const ANALYTICS_UNAVAILABLE_MESSAGE = "Analytics data is not available yet.";

function guardAccountability(workspace: CopilotWorkspaceContext): AccountabilityAnalytics | null {
  return workspace.accountability ?? null;
}

function formatCompletionStats(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { execution, taskStats } = workspace;
  const { kpis } = accountability;
  const totalMeetings = workspace.meetings.length;
  const totalTasks = workspace.tasks.length;

  return [
    "Completion statistics for your workspace:",
    "",
    "Accountability KPIs:",
    `• Completion rate: ${kpis.completionRate}%`,
    `• On-time completion: ${kpis.onTimeCompletionRate}%`,
    `• Average completion time: ${formatAverageCompletionTimeLabel(kpis.averageCompletionHours)}`,
    `• Completed this month: ${kpis.tasksCompletedThisMonth}`,
    "",
    "Execution tracking:",
    `• Open tasks: ${execution.totalOpen}`,
    `• Overdue: ${execution.overdue}`,
    `• Due today: ${execution.dueToday}`,
    `• Completed this week: ${execution.completedThisWeek}`,
    "",
    "Task breakdown:",
    `• Pending (non-overdue): ${taskStats.pendingTasks}`,
    `• Overdue: ${taskStats.overdueTasks}`,
    `• Completed (all time): ${taskStats.completedTasks}`,
    "",
    "Totals:",
    `• Meetings: ${totalMeetings}`,
    `• Tasks: ${totalTasks}`,
    `• Reminder emails sent: ${workspace.remindersSent}`,
  ].join("\n");
}

function formatCompletionRate(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { kpis } = accountability;
  const totalTasks = workspace.tasks.length;
  const completed = workspace.taskStats.completedTasks;

  return [
    "Team completion rate:",
    `• ${kpis.completionRate}% of assigned tasks are completed`,
    `• ${completed} of ${totalTasks} tasks completed`,
  ].join("\n");
}

function formatOnTimeCompletion(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { kpis } = accountability;

  return [
    "On-time completion rate:",
    `• ${kpis.onTimeCompletionRate}% of completed tasks with deadlines were finished on time`,
    "",
    "On-time means completed_at is on or before the task deadline.",
  ].join("\n");
}

function formatAverageCompletionTimeAnswer(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { kpis } = accountability;

  return [
    "Average completion time:",
    `• ${formatAverageCompletionTimeLabel(kpis.averageCompletionHours)} from start to completion`,
    "",
    "Based on started_at and completed_at (or matching status events).",
  ].join("\n");
}

function formatBestPerformer(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const insight = accountability.insights.highestCompletionRate;

  if (!insight) {
    return "No completed tasks by owners yet — best performer is not available.";
  }

  return [
    "Best performer (highest completion rate):",
    `• ${insight.ownerLabel}`,
    `• ${insight.metricLabel}: ${insight.value}`,
  ].join("\n");
}

function formatMostDelayedOwner(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const insight = accountability.insights.mostDelayedOwner;

  if (!insight) {
    return "No delayed or overdue tasks by owners — everyone is on track.";
  }

  return [
    "Most delayed owner:",
    `• ${insight.ownerLabel}`,
    `• ${insight.metricLabel}: ${insight.value}`,
    "",
    "Delay score counts late completions plus open tasks past their deadline.",
  ].join("\n");
}

function formatWeeklyCompletionTrend(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { weeklyCompletions } = accountability.charts;

  if (weeklyCompletions.every((point) => point.value === 0)) {
    return "No task completions recorded in the last 8 weeks.";
  }

  const lines = weeklyCompletions.map((point) => `• Week of ${point.week}: ${point.value} completed`);

  return ["Weekly completion trend (last 8 weeks):", "", lines.join("\n")].join("\n");
}

function formatExecutionHealth(workspace: CopilotWorkspaceContext): string {
  const accountability = guardAccountability(workspace);
  if (!accountability) return ANALYTICS_UNAVAILABLE_MESSAGE;

  const { kpis, insights, charts } = accountability;
  const trendLines = charts.weeklyCompletions
    .slice(-4)
    .map((point) => `• Week of ${point.week}: ${point.value} completed`);

  const ownerLines = [
    insights.highestCompletionRate
      ? `• Best performer: ${insights.highestCompletionRate.ownerLabel} (${insights.highestCompletionRate.value})`
      : "• Best performer: —",
    insights.mostDelayedOwner
      ? `• Most delayed: ${insights.mostDelayedOwner.ownerLabel} (${insights.mostDelayedOwner.metricLabel}: ${insights.mostDelayedOwner.value})`
      : "• Most delayed: —",
    insights.mostReliableOwner
      ? `• Most reliable (on-time): ${insights.mostReliableOwner.ownerLabel} (${insights.mostReliableOwner.value})`
      : "• Most reliable (on-time): —",
  ];

  return [
    "Execution health summary:",
    "",
    "KPIs:",
    `• Completion rate: ${kpis.completionRate}%`,
    `• On-time completion: ${kpis.onTimeCompletionRate}%`,
    `• Average completion time: ${formatAverageCompletionTimeLabel(kpis.averageCompletionHours)}`,
    `• Completed this month: ${kpis.tasksCompletedThisMonth}`,
    "",
    "Owner highlights:",
    ...ownerLines,
    "",
    "Recent weekly completions:",
    ...(trendLines.length > 0 ? trendLines : ["• No completions in recent weeks"]),
  ].join("\n");
}

function formatReminderHistory(workspace: CopilotWorkspaceContext): string {
  if (workspace.reminderHistory.length === 0) {
    return "No reminder emails have been recorded yet.";
  }

  const lines = workspace.reminderHistory.map((entry) => {
    const subject = entry.subject?.trim() || "Task reminder";
    return `• ${formatSentAt(entry.sentAt)} · ${entry.meetingTitle} · ${entry.recipient} · ${subject}`;
  });

  return [
    `Reminder history (${workspace.reminderHistory.length} recent):`,
    "",
    lines.join("\n"),
  ].join("\n");
}

export function formatCopilotMeetingResponse(
  intent: CopilotIntent,
  context: CopilotMeetingContext,
): string {
  switch (intent) {
    case "meeting_summary":
      return formatMeetingSummary(context);
    case "extracted_tasks":
      return formatExtractedTasks(context);
    case "task_owners":
      return formatTaskOwners(context);
    case "task_deadlines":
      return formatTaskDeadlines(context);
    case "reminder_status":
      return formatReminderStatus(context);
    default:
      return formatExtractedTasks(context);
  }
}

export function formatCopilotWorkspaceResponse(
  intent: CopilotIntent,
  workspace: CopilotWorkspaceContext,
  meetingId?: string | null,
): string {
  switch (intent) {
    case "pending_tasks":
      return formatPendingTasks(workspace, meetingId);
    case "overdue_tasks":
      return formatOverdueTasks(workspace, meetingId);
    case "completion_stats":
      return formatCompletionStats(workspace);
    case "reminder_history":
      return formatReminderHistory(workspace);
    case "execution_health":
      return formatExecutionHealth(workspace);
    case "completion_rate":
      return formatCompletionRate(workspace);
    case "on_time_completion":
      return formatOnTimeCompletion(workspace);
    case "average_completion_time":
      return formatAverageCompletionTimeAnswer(workspace);
    case "best_performer":
      return formatBestPerformer(workspace);
    case "most_delayed_owner":
      return formatMostDelayedOwner(workspace);
    case "weekly_completion_trend":
      return formatWeeklyCompletionTrend(workspace);
    case "owner_improvement":
    case "owner_decline":
    case "execution_bottlenecks":
    case "meetings_most_tasks":
    case "at_risk_owners":
    case "at_risk_tasks":
    case "weekly_focus":
    case "workload_imbalance":
    case "executive_briefing":
      return formatAdvancedCopilotResponse(intent, workspace);
    default:
      return formatExecutionHealth(workspace);
  }
}

/** @deprecated Use formatCopilotMeetingResponse */
export function formatCopilotResponse(
  intent: CopilotIntent,
  context: CopilotMeetingContext,
): string {
  return formatCopilotMeetingResponse(intent, context);
}

export function enrichTaskReminderCategories(
  tasks: CopilotTaskContext[],
  meeting: MeetingReference,
): CopilotTaskContext[] {
  const { upcomingWithinDays } = getReminderConfig();

  return tasks.map((task) => ({
    ...task,
    reminderCategory: classifyReminderTask(
      {
        id: task.id,
        meeting_id: meeting.id,
        task: task.task,
        owner: task.owner,
        deadline: task.deadline,
        status: task.storedStatus,
        meeting,
      },
      upcomingWithinDays,
    ),
  }));
}
