import { startOfDay } from "date-fns";
import { resolveDeadlineDate } from "@/lib/reminders/deadline-normalize";

/** Values persisted in Supabase `tasks.status`. */
export type StoredTaskStatus = "pending" | "in_progress" | "completed";

/** UI/reminder-facing status; overdue is derived, not stored. */
export type DisplayTaskStatus = StoredTaskStatus | "overdue";

export const STORED_TASK_STATUSES: StoredTaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
];

export const TASK_STATUS_LABELS: Record<DisplayTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  overdue: "Overdue",
};

export function normalizeStoredStatus(raw: string | null | undefined): StoredTaskStatus {
  const normalized = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";

  if (normalized === "completed" || normalized === "done" || normalized === "closed") {
    return "completed";
  }

  if (
    normalized === "in_progress" ||
    normalized === "inprogress" ||
    normalized === "progress"
  ) {
    return "in_progress";
  }

  if (normalized === "open" || normalized === "todo") {
    return "pending";
  }

  return "pending";
}

export function isStoredTaskStatus(value: string): value is StoredTaskStatus {
  return STORED_TASK_STATUSES.includes(value as StoredTaskStatus);
}

export function isTaskCompletedStatus(status: string | null | undefined): boolean {
  return normalizeStoredStatus(status) === "completed";
}

export function isTaskOverdue(
  deadline: string | null | undefined,
  referenceDate: Date = new Date(),
): boolean {
  const parsed = resolveDeadlineDate(deadline, referenceDate);
  if (!parsed.date) return false;
  return parsed.date < startOfDay(referenceDate);
}

export function resolveDisplayTaskStatus(
  storedStatus: string | null | undefined,
  deadline: string | null | undefined,
  referenceDate: Date = new Date(),
): DisplayTaskStatus {
  const stored = normalizeStoredStatus(storedStatus);
  if (stored === "completed") return "completed";
  if (isTaskOverdue(deadline, referenceDate)) return "overdue";
  return stored;
}

/** Badge label aligned with the status dropdown (stored selection). */
export function resolveTaskBadgeStatus(
  storedStatus: string | null | undefined,
  deadline: string | null | undefined,
  referenceDate: Date = new Date(),
): DisplayTaskStatus {
  const stored = normalizeStoredStatus(storedStatus);
  if (stored === "completed" || stored === "in_progress") return stored;
  if (isTaskOverdue(deadline, referenceDate)) return "overdue";
  return stored;
}

export function canReceiveTaskReminders(status: string | null | undefined): boolean {
  return !isTaskCompletedStatus(status);
}
