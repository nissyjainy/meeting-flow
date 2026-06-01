import { computeExecutionMetrics } from "@/lib/dashboard/execution-metrics";
import { isTaskCompletedStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { classifyReminderTask } from "@/lib/reminders/task-reminder-classify";
import { getReminderConfig } from "@/lib/reminders/reminder-env";
import type { ReminderCategory } from "@/lib/reminders/task-reminder-types";

export type TasksPageMetrics = {
  openTasks: number;
  overdue: number;
  dueToday: number;
  completed: number;
};

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

export function computeTasksPageMetrics(tasks: MeetingTaskRecord[]): TasksPageMetrics {
  const { execution } = computeExecutionMetrics(tasks);
  const completed = tasks.filter((task) => isTaskCompletedStatus(task.status)).length;

  return {
    openTasks: execution.totalOpen,
    overdue: execution.overdue,
    dueToday: execution.dueToday,
    completed,
  };
}

export const ACTIVE_TASKS_PREVIEW_LIMIT = 10;

export function selectActiveTasksForDisplay(
  tasks: MeetingTaskRecord[],
  limit: number | null = ACTIVE_TASKS_PREVIEW_LIMIT,
): MeetingTaskRecord[] {
  const { upcomingWithinDays } = getReminderConfig();

  const open = tasks.filter((task) => !isTaskCompletedStatus(task.status));
  const completed = tasks.filter((task) => isTaskCompletedStatus(task.status));

  const rankedOpen = open
    .map((task) => ({
      task,
      category: classifyOpenTask(task, upcomingWithinDays),
    }))
    .sort((a, b) => {
      const orderDiff = PRIORITY_ORDER[a.category] - PRIORITY_ORDER[b.category];
      if (orderDiff !== 0) return orderDiff;
      return a.task.task.localeCompare(b.task.task);
    })
    .map(({ task }) => task);

  const rankedCompleted = [...completed].sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.created_at);
    const bTime = Date.parse(b.updated_at || b.created_at);
    return bTime - aTime;
  });

  const combined = [...rankedOpen, ...rankedCompleted];
  return limit == null ? combined : combined.slice(0, limit);
}
