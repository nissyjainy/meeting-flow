import { endOfWeek, startOfWeek } from "date-fns";
import { isTaskCompletedStatus, resolveDisplayTaskStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { classifyReminderTask } from "@/lib/reminders/task-reminder-classify";
import { getReminderConfig } from "@/lib/reminders/reminder-env";
import type { ReminderCategory } from "@/lib/reminders/task-reminder-types";
import type { DashboardPriorityTask, ExecutionSummary } from "./analytics-types";

const PRIORITY_ORDER: Record<ReminderCategory, number> = {
  overdue: 0,
  sameDay: 1,
  upcoming: 2,
  pending: 3,
};

function stubMeeting(meetingId: string) {
  return {
    id: meetingId,
    title: "",
    fileName: "",
    createdAt: "",
    url: "",
  };
}

function classifyOpenTask(task: MeetingTaskRecord, upcomingWithinDays: number): ReminderCategory {
  return (
    classifyReminderTask(
      {
        id: task.id,
        meeting_id: task.meeting_id,
        task: task.task,
        owner: task.owner,
        deadline: task.deadline,
        status: task.status,
        meeting: stubMeeting(task.meeting_id),
      },
      upcomingWithinDays,
    ) ?? "pending"
  );
}

function parseTaskTimestamp(task: MeetingTaskRecord): Date | null {
  const raw = task.updated_at || task.created_at;
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isCompletedThisWeek(task: MeetingTaskRecord, referenceDate: Date): boolean {
  if (!isTaskCompletedStatus(task.status)) return false;

  const completedAt = parseTaskTimestamp(task);
  if (!completedAt) return false;

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return completedAt >= weekStart && completedAt <= weekEnd;
}

export function computeExecutionMetrics(
  tasks: MeetingTaskRecord[],
  referenceDate = new Date(),
): {
  execution: ExecutionSummary;
  topPriorities: DashboardPriorityTask[];
} {
  const { upcomingWithinDays } = getReminderConfig();

  let totalOpen = 0;
  let overdue = 0;
  let dueToday = 0;
  let completedThisWeek = 0;

  const ranked: Array<{ task: MeetingTaskRecord; category: ReminderCategory }> = [];

  for (const task of tasks) {
    if (isTaskCompletedStatus(task.status)) {
      if (isCompletedThisWeek(task, referenceDate)) {
        completedThisWeek += 1;
      }
      continue;
    }

    totalOpen += 1;
    const category = classifyOpenTask(task, upcomingWithinDays);

    if (category === "overdue") overdue += 1;
    else if (category === "sameDay") dueToday += 1;

    ranked.push({ task, category });
  }

  ranked.sort((a, b) => {
    const orderDiff = PRIORITY_ORDER[a.category] - PRIORITY_ORDER[b.category];
    if (orderDiff !== 0) return orderDiff;
    return a.task.task.localeCompare(b.task.task);
  });

  const topPriorities: DashboardPriorityTask[] = ranked.slice(0, 5).map(({ task }) => ({
    id: task.id,
    title: task.task,
    displayStatus: resolveDisplayTaskStatus(task.status, task.deadline),
    dueDate: task.deadline,
    meetingId: task.meeting_id,
  }));

  return {
    execution: {
      totalOpen,
      overdue,
      dueToday,
      completedThisWeek,
    },
    topPriorities,
  };
}
