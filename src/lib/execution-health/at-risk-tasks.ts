import { addDays, endOfDay, startOfDay } from "date-fns";
import { isTaskCompletedStatus } from "@/lib/meetings/task-status";
import type { MeetingTaskRecord } from "@/lib/meetings/types";
import { resolveDeadlineDate } from "@/lib/reminders/deadline-normalize";

export type AtRiskTaskRow = {
  id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  dueDate: Date;
};

export function listAtRiskTasks(
  tasks: MeetingTaskRecord[],
  referenceDate: Date = new Date(),
  limit = 10,
): AtRiskTaskRow[] {
  const today = startOfDay(referenceDate);
  const horizonEnd = endOfDay(addDays(today, 3));

  const atRisk = tasks
    .filter((task) => !isTaskCompletedStatus(task.status))
    .map((task) => {
      const { date: dueDate } = resolveDeadlineDate(task.deadline, referenceDate);
      return { task, dueDate };
    })
    .filter(
      (row): row is { task: MeetingTaskRecord; dueDate: Date } =>
        row.dueDate != null && row.dueDate >= today && row.dueDate <= horizonEnd,
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, limit)
    .map(({ task, dueDate }) => ({
      id: task.id,
      task: task.task,
      owner: task.owner,
      deadline: task.deadline,
      dueDate,
    }));

  return atRisk;
}

export function countAtRiskTasks(
  tasks: MeetingTaskRecord[],
  referenceDate: Date = new Date(),
): number {
  const today = startOfDay(referenceDate);
  const horizonEnd = endOfDay(addDays(today, 3));

  return tasks.filter((task) => {
    if (isTaskCompletedStatus(task.status)) return false;
    const { date: dueDate } = resolveDeadlineDate(task.deadline, referenceDate);
    return dueDate != null && dueDate >= today && dueDate <= horizonEnd;
  }).length;
}
