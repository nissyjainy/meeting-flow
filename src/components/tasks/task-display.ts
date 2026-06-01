import type { MeetingTaskRecord } from "@/lib/meetings/types";
import {
  normalizeStoredStatus,
  resolveTaskBadgeStatus,
  TASK_STATUS_LABELS,
  type DisplayTaskStatus,
  type StoredTaskStatus,
} from "@/lib/meetings/task-status";

export type KanbanColumnId = "todo" | "in-progress" | "done";

export type TaskStatusFilter = "all" | "todo" | "in-progress" | "done";

/** Supabase `tasks.status` values used by the app (after normalization). */
export const SUPABASE_TASK_STATUSES: StoredTaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
];

const KANBAN_COLUMN_LABELS: Record<KanbanColumnId, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

const FILTER_TO_STORED_STATUS: Record<Exclude<TaskStatusFilter, "all">, StoredTaskStatus> = {
  todo: "pending",
  "in-progress": "in_progress",
  done: "completed",
};

const COLUMN_TO_STORED_STATUS: Record<KanbanColumnId, StoredTaskStatus> = {
  todo: "pending",
  "in-progress": "in_progress",
  done: "completed",
};

export function storedStatusForFilter(
  filter: Exclude<TaskStatusFilter, "all">,
): StoredTaskStatus {
  return FILTER_TO_STORED_STATUS[filter];
}

export function taskStoredStatus(task: MeetingTaskRecord): StoredTaskStatus {
  return normalizeStoredStatus(task.status);
}

export function kanbanColumnLabel(column: KanbanColumnId): string {
  return KANBAN_COLUMN_LABELS[column];
}

export function kanbanColumnToStoredStatus(column: KanbanColumnId): StoredTaskStatus {
  return COLUMN_TO_STORED_STATUS[column];
}

export function taskMatchesKanbanColumn(
  task: MeetingTaskRecord,
  column: KanbanColumnId,
): boolean {
  return taskStoredStatus(task) === COLUMN_TO_STORED_STATUS[column];
}

export function taskMatchesStatusFilter(
  task: MeetingTaskRecord,
  filter: TaskStatusFilter,
): boolean {
  if (filter === "all") return true;
  return taskStoredStatus(task) === FILTER_TO_STORED_STATUS[filter];
}

export function logTaskFilterDebug(
  filter: TaskStatusFilter,
  tasks: MeetingTaskRecord[],
  filtered: MeetingTaskRecord[],
): void {
  const statusCounts = tasks.reduce<Record<string, number>>((counts, task) => {
    const key = taskStoredStatus(task);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  console.info("[tasks-filter]", {
    filter,
    tabValue: filter,
    expectedStoredStatus: filter === "all" ? null : FILTER_TO_STORED_STATUS[filter],
    supabaseStatuses: SUPABASE_TASK_STATUSES,
    tabMatchesDatabase:
      filter === "all" || SUPABASE_TASK_STATUSES.includes(FILTER_TO_STORED_STATUS[filter]),
    totalTasks: tasks.length,
    filteredCount: filtered.length,
    statusCounts,
    sample: tasks.slice(0, 5).map((task) => ({
      id: task.id,
      rawStatus: task.status,
      normalizedStatus: taskStoredStatus(task),
    })),
  });
}

export function resolveTaskDisplayStatus(task: MeetingTaskRecord): DisplayTaskStatus {
  return resolveTaskBadgeStatus(task.status, task.deadline);
}

export function taskDisplayStatusLabel(task: MeetingTaskRecord): string {
  return TASK_STATUS_LABELS[resolveTaskDisplayStatus(task)];
}

export function taskStatusBadgeClassName(status: DisplayTaskStatus): string {
  switch (status) {
    case "completed":
      return "border-success/30 bg-success/10 text-success";
    case "overdue":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "in_progress":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-warning/30 bg-warning/10 text-warning";
  }
}

export function ownerLabel(owner: string | null): string {
  return owner?.trim() || "—";
}

export function formatDueDateLabel(deadline: string | null): string {
  const trimmed = deadline?.trim();
  if (!trimmed) return "No due date";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  return trimmed;
}

export function taskMatchesSearch(task: MeetingTaskRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    task.task.toLowerCase().includes(normalized) ||
    (task.owner?.toLowerCase().includes(normalized) ?? false) ||
    (task.deadline?.toLowerCase().includes(normalized) ?? false) ||
    task.meeting_id.toLowerCase().includes(normalized)
  );
}
