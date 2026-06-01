import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { computeLifecycleTimestamps } from "./task-lifecycle";
import {
  mapMeetingTaskRow,
  TASK_COLUMNS,
  type TaskStatusUpdatePayload,
} from "./task-record";
import { insertTaskStatusEvent } from "./task-status-events.server";
import type { MeetingTaskRecord } from "./types";
import { isStoredTaskStatus, normalizeStoredStatus } from "./task-status";

const UpdateTaskStatusInput = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed"]),
});

function parseUpdateTaskStatusInput(raw: unknown): TaskStatusUpdatePayload {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.taskId === "string" && typeof obj.status === "string") {
      return UpdateTaskStatusInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return UpdateTaskStatusInput.parse(obj.data);
    }
  }
  return UpdateTaskStatusInput.parse(raw);
}

async function loadTaskForUpdate(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  taskId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as Record<string, unknown>;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(`Task not found (taskId=${taskId}).`);
  }

  const { data: adminData, error: adminError } = await admin
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", taskId)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message);
  }

  if (!adminData) {
    throw new Error(`Task not found (taskId=${taskId}).`);
  }

  return adminData as Record<string, unknown>;
}

async function persistTaskStatusUpdate(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  payload: TaskStatusUpdatePayload,
  actorUserId: string | null,
): Promise<MeetingTaskRecord> {
  const currentRow = await loadTaskForUpdate(supabase, payload.taskId);
  const currentRecord = mapMeetingTaskRow(currentRow);

  if (!currentRecord) {
    throw new Error(`Task not found or invalid (taskId=${payload.taskId}).`);
  }

  const fromStatus = normalizeStoredStatus(currentRecord.status);
  const toStatus = payload.status;

  if (fromStatus === toStatus) {
    console.info("[task-status] no-op — status unchanged", {
      taskId: payload.taskId,
      status: toStatus,
    });
    return currentRecord;
  }

  const lifecycle = computeLifecycleTimestamps(currentRecord, toStatus);
  const updatePayload = {
    status: toStatus,
    started_at: lifecycle.started_at,
    completed_at: lifecycle.completed_at,
  };

  console.info("[task-status] Supabase update payload", {
    taskId: payload.taskId,
    payload: updatePayload,
    fromStatus,
    toStatus,
  });

  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", payload.taskId)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[task-status] Supabase update failed", {
      taskId: payload.taskId,
      payload: updatePayload,
      error: error.message,
    });
    throw new Error(error.message);
  }

  let updatedRow = data as Record<string, unknown> | null;

  if (!updatedRow) {
    updatedRow = await persistTaskStatusUpdateWithAdminFallback(
      supabase,
      payload,
      currentRecord,
      updatePayload,
    );
  }

  await insertTaskStatusEvent(supabase, {
    taskId: payload.taskId,
    meetingId: currentRecord.meeting_id,
    fromStatus,
    toStatus,
    source: "app",
    actorUserId,
  });

  const record = mapMeetingTaskRow(updatedRow);
  if (!record) {
    throw new Error("Task status update returned an invalid row.");
  }

  return record;
}

async function persistTaskStatusUpdateWithAdminFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  payload: TaskStatusUpdatePayload,
  _currentRecord: MeetingTaskRecord,
  updatePayload: {
    status: TaskStatusUpdatePayload["status"];
    started_at: string | null;
    completed_at: string | null;
  },
): Promise<Record<string, unknown>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const message = "You must be signed in to update task status.";
    console.error("[task-status] Supabase update failed", {
      taskId: payload.taskId,
      payload: updatePayload,
      error: message,
    });
    throw new Error(message);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    const message =
      "Task status update affected 0 rows. Apply migration 20260520600000_task_status.sql (tasks UPDATE RLS policy).";
    console.error("[task-status] Supabase update failed", {
      taskId: payload.taskId,
      payload: updatePayload,
      error: message,
    });
    throw new Error(message);
  }

  console.warn("[task-status] user-scoped update returned 0 rows; using service-role fallback", {
    taskId: payload.taskId,
    userId: user.id,
    hint: "Apply migration 20260520600000_task_status.sql to enable UPDATE RLS.",
  });

  const { data, error } = await admin
    .from("tasks")
    .update(updatePayload)
    .eq("id", payload.taskId)
    .select(TASK_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[task-status] Supabase admin update failed", {
      taskId: payload.taskId,
      payload: updatePayload,
      error: error.message,
    });
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Task status update affected 0 rows (taskId=${payload.taskId}).`);
  }

  return data as Record<string, unknown>;
}

export const updateMeetingTaskStatusFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const parsed = parseUpdateTaskStatusInput(raw);
    if (!isStoredTaskStatus(parsed.status)) {
      throw new Error(`Invalid task status: ${parsed.status}`);
    }
    return parsed;
  })
  .handler(async ({ data }): Promise<MeetingTaskRecord> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const record = await persistTaskStatusUpdate(supabase, data, user?.id ?? null);

    console.info("[task-status] Supabase update success", {
      taskId: record.id,
      requestedStatus: data.status,
      persistedStatus: record.status,
      meetingId: record.meeting_id,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      statusMatch: record.status === data.status,
    });

    return record;
  });
