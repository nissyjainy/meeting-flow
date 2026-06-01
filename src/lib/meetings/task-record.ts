import { normalizeStoredStatus, type StoredTaskStatus } from "./task-status";
import type { MeetingTaskRecord } from "./types";

export const TASK_COLUMNS =
  "id,meeting_id,task,owner,deadline,status,created_at,updated_at,started_at,completed_at";

export function mapMeetingTaskRow(row: Record<string, unknown>): MeetingTaskRecord | null {
  const taskText = String(row.task ?? row.description ?? "").trim();
  if (!taskText) return null;

  const rawStatus = row.status != null ? String(row.status) : "pending";
  const normalizedStatus = normalizeStoredStatus(rawStatus);

  return {
    id: String(row.id),
    meeting_id: String(row.meeting_id),
    task: taskText,
    owner: row.owner != null ? String(row.owner) : null,
    deadline:
      row.deadline != null
        ? String(row.deadline)
        : row.due_date != null
          ? String(row.due_date)
          : null,
    status: normalizedStatus,
    created_at: String(row.created_at),
    updated_at:
      row.updated_at != null
        ? String(row.updated_at)
        : row.created_at != null
          ? String(row.created_at)
          : new Date().toISOString(),
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
  };
}

export function logRefetchedTaskStatuses(
  meetingId: string,
  rows: Record<string, unknown>[],
): void {
  for (const row of rows) {
    const rawStatus = row.status != null ? String(row.status) : null;
    console.info("[task-status] refetched task", {
      meetingId,
      taskId: String(row.id),
      rawStatus,
      normalizedStatus: normalizeStoredStatus(rawStatus ?? "pending"),
    });
  }
}

export type TaskStatusUpdatePayload = {
  taskId: string;
  status: StoredTaskStatus;
};
