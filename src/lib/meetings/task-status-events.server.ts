import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskStatusEventSource } from "./task-lifecycle";
import type { StoredTaskStatus } from "./task-status";

export type TaskStatusEventInsert = {
  taskId: string;
  meetingId: string;
  fromStatus: StoredTaskStatus | null;
  toStatus: StoredTaskStatus;
  source: TaskStatusEventSource;
  actorUserId?: string | null;
  occurredAt?: string;
};

export async function insertTaskStatusEvent(
  supabase: SupabaseClient,
  event: TaskStatusEventInsert,
): Promise<void> {
  const { error } = await supabase.from("task_status_events").insert({
    task_id: event.taskId,
    meeting_id: event.meetingId,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    actor_user_id: event.actorUserId ?? null,
    source: event.source,
    ...(event.occurredAt ? { occurred_at: event.occurredAt } : {}),
  });

  if (error) {
    throw new Error(`Failed to record task status event: ${error.message}`);
  }
}

export async function insertTaskStatusEvents(
  supabase: SupabaseClient,
  events: TaskStatusEventInsert[],
): Promise<void> {
  if (events.length === 0) return;

  const { error } = await supabase.from("task_status_events").insert(
    events.map((event) => ({
      task_id: event.taskId,
      meeting_id: event.meetingId,
      from_status: event.fromStatus,
      to_status: event.toStatus,
      actor_user_id: event.actorUserId ?? null,
      source: event.source,
      ...(event.occurredAt ? { occurred_at: event.occurredAt } : {}),
    })),
  );

  if (error) {
    throw new Error(`Failed to record task status events: ${error.message}`);
  }
}
