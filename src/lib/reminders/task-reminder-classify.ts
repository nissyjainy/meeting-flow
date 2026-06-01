import { isSameDay, startOfDay } from "date-fns";
import { isTaskCompletedStatus } from "@/lib/meetings/task-status";
import type { ClassifiedReminderTasks, ReminderCategory, ReminderTaskItem } from "./task-reminder-types";
import { countClassifiedTasks } from "./reminder-labels";
import { reminderLog } from "./reminder-debug";
import { parseDeadlineDate, resolveDeadlineDate } from "./deadline-normalize";

export { parseDeadlineDate } from "./deadline-normalize";

export function isTaskCompleted(status: string): boolean {
  return isTaskCompletedStatus(status);
}

export function classifyReminderTask(
  task: ReminderTaskItem,
  upcomingWithinDays: number,
  referenceDate: Date = new Date(),
): ReminderCategory | null {
  if (isTaskCompleted(task.status)) {
    console.info("[task-status] reminder skipped (completed)", {
      taskId: task.id,
      status: task.status,
    });
    return null;
  }

  const today = startOfDay(referenceDate);
  const parsed = resolveDeadlineDate(task.deadline, referenceDate);
  const deadlineDate = parsed.date;

  let category: ReminderCategory = "pending";

  if (deadlineDate) {
    if (deadlineDate < today) {
      category = "overdue";
    } else if (isSameDay(deadlineDate, today)) {
      category = "sameDay";
    } else {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / msPerDay);
      if (daysUntil > 0 && daysUntil <= upcomingWithinDays) {
        category = "upcoming";
      }
    }
  }

  if (task.deadline?.trim()) {
    reminderLog("deadline classification", {
      taskId: task.id,
      rawDeadline: task.deadline,
      parseSource: parsed.source,
      normalizedPhrase: parsed.normalizedPhrase ?? null,
      normalizedDate: deadlineDate?.toISOString().slice(0, 10) ?? null,
      category,
      upcomingWithinDays,
    });
  }

  return category;
}

export function createEmptyClassifiedTasks(): ClassifiedReminderTasks {
  return {
    pending: [],
    upcoming: [],
    sameDay: [],
    overdue: [],
  };
}

export function classifyReminderTasks(
  tasks: ReminderTaskItem[],
  upcomingWithinDays: number,
  referenceDate: Date = new Date(),
): ClassifiedReminderTasks {
  const result = createEmptyClassifiedTasks();

  for (const task of tasks) {
    const category = classifyReminderTask(task, upcomingWithinDays, referenceDate);
    if (!category) continue;
    result[category].push(task);
  }

  return result;
}

export function hasRemindableTasks(classified: ClassifiedReminderTasks): boolean {
  const counts = countClassifiedTasks(classified);
  return counts.pending + counts.upcoming + counts.sameDay + counts.overdue > 0;
}

export function normalizeClassifiedTasks(
  classified: Partial<ClassifiedReminderTasks> | ClassifiedReminderTasks,
): ClassifiedReminderTasks {
  return {
    pending: classified.pending ?? [],
    upcoming: classified.upcoming ?? [],
    sameDay: classified.sameDay ?? [],
    overdue: classified.overdue ?? [],
  };
}

export function filterClassifiedByCategories(
  classified: ClassifiedReminderTasks,
  categories?: ReminderCategory[],
): ClassifiedReminderTasks {
  if (!categories) return classified;

  return {
    pending: categories.includes("pending") ? classified.pending : [],
    upcoming: categories.includes("upcoming") ? classified.upcoming : [],
    sameDay: categories.includes("sameDay") ? classified.sameDay : [],
    overdue: categories.includes("overdue") ? classified.overdue : [],
  };
}

export { countClassifiedTasks };
