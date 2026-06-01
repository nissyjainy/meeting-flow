import { normalizeStoredStatus, type StoredTaskStatus } from "./task-status";

export type TaskStatusEventSource = "app" | "extraction" | "backfill" | "system";

export type TaskLifecycleTimestamps = {
  started_at: string | null;
  completed_at: string | null;
};

export function computeLifecycleTimestamps(
  current: {
    status: string | null | undefined;
    started_at: string | null;
    completed_at: string | null;
  },
  nextStatus: StoredTaskStatus,
  now: Date = new Date(),
): TaskLifecycleTimestamps {
  const iso = now.toISOString();
  const normalizedCurrent = normalizeStoredStatus(current.status);

  let started_at = current.started_at;
  let completed_at = current.completed_at;

  if (nextStatus === "in_progress" && !started_at) {
    started_at = iso;
  }

  if (nextStatus === "completed") {
    completed_at = iso;
  } else if (normalizedCurrent === "completed") {
    completed_at = null;
  }

  return { started_at, completed_at };
}
