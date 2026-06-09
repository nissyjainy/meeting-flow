import { createClient } from "@/lib/supabase/client";
import {
  mapTaskStatusEventRow,
  TASK_STATUS_EVENT_COLUMNS,
} from "@/lib/analytics/task-status-event-record";
import type { TaskStatusEventRecord } from "@/lib/analytics/task-status-event-record";
import type { MeetingRecord, MeetingTaskRecord } from "./types";
import type { StoredTaskStatus } from "./task-status";
import { enrichMeetingRecord } from "./record";
import { generateMeetingSummaryFn } from "./summary";
import { transcribeMeetingFn } from "./transcription";
import { createMeetingRecordFn } from "./upload-server";
import { updateMeetingTaskStatusFn } from "./update-task-status.server";
import { logRefetchedTaskStatuses, mapMeetingTaskRow, TASK_COLUMNS } from "./task-record";
import { MEETINGS_BUCKET } from "./constants";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "./upload-debug";

const MEETING_COLUMNS =
  "id,file_name,file_url,transcript,summary,status,transcript_error,created_at,title,platform,meeting_url,meeting_code";

export async function listMeetingTasks(meetingId: string): Promise<MeetingTaskRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  logRefetchedTaskStatuses(meetingId, rows);

  return rows
    .map((row) => mapMeetingTaskRow(row))
    .filter((row): row is MeetingTaskRecord => row !== null);
}

export async function listAllTasks(): Promise<MeetingTaskRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapMeetingTaskRow(row as Record<string, unknown>))
    .filter((row): row is MeetingTaskRecord => row !== null);
}

export async function listAllTaskStatusEvents(): Promise<TaskStatusEventRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_status_events")
    .select(TASK_STATUS_EVENT_COLUMNS)
    .order("occurred_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapTaskStatusEventRow(row as Record<string, unknown>))
    .filter((row): row is TaskStatusEventRecord => row !== null);
}

export async function updateMeetingTaskStatus(
  taskId: string,
  status: StoredTaskStatus,
): Promise<MeetingTaskRecord> {
  console.info("[task-status] update requested", { taskId, status, payload: { status } });

  try {
    const record = await updateMeetingTaskStatusFn({ data: { taskId, status } });
    console.info("[task-status] update success (client)", {
      taskId,
      requestedStatus: status,
      persistedStatus: record.status,
    });
    return record;
  } catch (error) {
    console.error("[task-status] update failure (client)", {
      taskId,
      status,
      payload: { status },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function listMeetings(): Promise<MeetingRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(enrichMeetingRecord);
}

export async function getMeeting(id: string): Promise<MeetingRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? enrichMeetingRecord(data) : null;
}

export type CreateMeetingInput = {
  meetingId: string;
  fileName: string;
  fileUrl: string;
  transcript?: string | null;
};

export async function createMeetingRecord(input: CreateMeetingInput): Promise<MeetingRecord> {
  uploadDebug("DB insert started (client → createMeetingRecordFn)", {
    meetingId: input.meetingId,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
  });

  try {
    const record = await createMeetingRecordFn({
      data: {
        meetingId: input.meetingId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        transcript: input.transcript ?? null,
      },
    });
    uploadDebug("DB insert success (client)", { recordId: record.id });
    return uploadDebugReturn("createMeetingRecord success", record, { recordId: record.id });
  } catch (error) {
    uploadDebugError("DB insert failed (client)", error, {
      meetingId: input.meetingId,
      fileName: input.fileName,
    });
    throw error;
  }
}

export async function deleteMeeting(id: string): Promise<void> {
  const supabase = createClient();

  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("file_url")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  if (meeting.file_url) {
    const { error: storageError } = await supabase.storage
      .from(MEETINGS_BUCKET)
      .remove([meeting.file_url]);

    if (storageError) throw new Error(storageError.message);
  }

  const { error: deleteError } = await supabase.from("meetings").delete().eq("id", id);
  if (deleteError) throw new Error(deleteError.message);
}

export async function getMeetingSignedUrl(fileUrl: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(MEETINGS_BUCKET)
    .createSignedUrl(fileUrl, 60 * 60);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function transcribeMeeting(
  meetingId: string,
): Promise<{ transcript: string; aiOutcome: "complete" | "partial" }> {
  uploadDebug("transcription started (client → transcribeMeetingFn)", { meetingId });

  try {
    const result = await transcribeMeetingFn({ data: { meetingId } });
    uploadDebug("transcription success (client)", {
      meetingId,
      transcriptLength: result.transcript?.length ?? 0,
    });

    let aiOutcome: "complete" | "partial" = "partial";
    try {
      uploadDebug("summary started (client → generateMeetingSummaryFn)", { meetingId });
      const summaryResult = await generateMeetingSummaryFn({ data: { meetingId } });
      if (!summaryResult?.summary?.trim()) {
        const err = new Error("Summary server function returned empty summary.");
        uploadDebugError("summary failed (client)", err, { meetingId, summaryResult });
      } else if (summaryResult.tasks?.success === false) {
        uploadDebugError("task extraction partial failure (client)", new Error(summaryResult.tasks ? "Task extraction failed" : "No task outcome"), {
          meetingId,
          tasks: summaryResult.tasks,
        });
        aiOutcome = "partial";
      } else {
        aiOutcome = "complete";
        uploadDebug("summary success (client)", {
          meetingId,
          summaryLength: summaryResult.summary.length,
          tasksInserted: summaryResult.tasks?.insertedCount ?? 0,
        });
      }
    } catch (summaryError) {
      uploadDebugError("summary failed (client)", summaryError, {
        meetingId,
        note: "Check terminal for [meeting-summary] logs; meeting status should be set to failed in DB.",
      });
      aiOutcome = "partial";
    }

    return uploadDebugReturn(
      "transcribeMeeting success",
      { ...result, aiOutcome },
      { meetingId, aiOutcome },
    );
  } catch (error) {
    uploadDebugError("transcription failed (client)", error, { meetingId });
    throw error;
  }
}
