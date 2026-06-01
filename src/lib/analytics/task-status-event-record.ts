export type TaskStatusEventRecord = {
  id: string;
  task_id: string;
  meeting_id: string;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  source: string;
  occurred_at: string;
};

export const TASK_STATUS_EVENT_COLUMNS =
  "id,task_id,meeting_id,from_status,to_status,actor_user_id,source,occurred_at";

export function mapTaskStatusEventRow(row: Record<string, unknown>): TaskStatusEventRecord | null {
  if (!row.id || !row.task_id || !row.meeting_id || !row.to_status || !row.occurred_at) {
    return null;
  }

  return {
    id: String(row.id),
    task_id: String(row.task_id),
    meeting_id: String(row.meeting_id),
    from_status: row.from_status != null ? String(row.from_status) : null,
    to_status: String(row.to_status),
    actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
    source: String(row.source ?? "app"),
    occurred_at: String(row.occurred_at),
  };
}
