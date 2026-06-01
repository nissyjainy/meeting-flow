import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTasksFromTranscript } from "./task-extraction-groq";
import { taskError, taskLog } from "./task-extraction-debug";
import { TASK_COLUMNS, mapMeetingTaskRow } from "./task-record";
import { insertTaskStatusEvents } from "./task-status-events.server";

export type TaskExtractionOutcome = {
  success: boolean;
  insertedCount: number;
  extractedCount: number;
  error?: string;
};

const DEFAULT_TASK_STATUS = "pending";

async function maybeTriggerRemindersAfterTasks(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  meetingId: string,
  reason: string,
): Promise<void> {
  try {
    const { fetchMeetingTasks } = await import("@/lib/reminders/task-reminder-data.server");
    const { tasks } = await fetchMeetingTasks(supabase, meetingId);
    if (tasks.length === 0) {
      taskLog("reminder skipped — no tasks in DB", { meetingId, reason });
      return;
    }

    taskLog("reminder trigger scheduled", { meetingId, reason, taskCount: tasks.length });
    const { triggerMeetingTaskReminders } = await import(
      "@/lib/reminders/trigger-meeting-reminders.server"
    );
    const reminderOutcome = await triggerMeetingTaskReminders(meetingId, reason);
    taskLog("task reminder email finished", {
      meetingId,
      reason,
      sent: reminderOutcome.sent,
      success: reminderOutcome.success,
      skippedReason: reminderOutcome.skippedReason ?? null,
      error: reminderOutcome.error ?? null,
      counts: reminderOutcome.counts ?? null,
    });
  } catch (reminderErr) {
    taskError("task reminder email threw (non-fatal)", reminderErr, { meetingId, reason });
  }
}

export async function runMeetingTaskExtractionPipeline(
  meetingId: string,
  transcriptOverride?: string,
): Promise<TaskExtractionOutcome> {
  taskLog("task extraction started", { meetingId, hasTranscriptOverride: Boolean(transcriptOverride) });

  const supabase = getSupabaseServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      taskError("auth check failed before task extraction", authError, { meetingId });
    } else {
      taskLog("auth context for task extraction", {
        meetingId,
        userId: user?.id ?? null,
        authenticated: Boolean(user),
      });
    }

    let transcript = transcriptOverride?.trim() ?? "";

    if (!transcript) {
      taskLog("loading transcript from DB", { meetingId });

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id,transcript")
        .eq("id", meetingId)
        .maybeSingle();

      if (meetingError) {
        throw new Error(`Fetch meeting failed: ${meetingError.message}`);
      }
      if (!meeting) {
        throw new Error(`Meeting not found for id ${meetingId}`);
      }

      transcript = meeting.transcript?.trim() ?? "";
      taskLog("transcript loaded", {
        meetingId,
        transcriptLength: transcript.length,
        hasTranscript: Boolean(transcript),
      });
    } else {
      taskLog("transcript loaded (from pipeline override)", {
        meetingId,
        transcriptLength: transcript.length,
      });
    }

    if (!transcript) {
      taskLog("final task pipeline status: skipped (no transcript)", { meetingId });
      return { success: true, insertedCount: 0, extractedCount: 0 };
    }

    const extracted = await extractTasksFromTranscript(transcript);
    taskLog("extracted tasks count", { meetingId, count: extracted.length });

    if (extracted.length === 0) {
      taskLog("final task pipeline status: complete (no tasks found)", { meetingId });
      await maybeTriggerRemindersAfterTasks(supabase, meetingId, "post-extraction-empty");
      return { success: true, insertedCount: 0, extractedCount: 0 };
    }

    const { error: deleteError, count: deletedCount } = await supabase
      .from("tasks")
      .delete({ count: "exact" })
      .eq("meeting_id", meetingId);

    if (deleteError) {
      taskError("task delete existing failed (continuing)", deleteError, {
        meetingId,
        code: deleteError.code,
      });
    } else {
      taskLog("cleared existing tasks for meeting", { meetingId, deletedCount: deletedCount ?? 0 });
    }

    const rows = extracted.map((item) => ({
      meeting_id: meetingId,
      task: item.task,
      owner: item.owner,
      deadline: item.deadline,
      status: DEFAULT_TASK_STATUS,
    }));

    taskLog("task DB insert started", {
      meetingId,
      rowCount: rows.length,
      sample: rows.slice(0, 2),
    });

    const { data: inserted, error: insertError } = await supabase
      .from("tasks")
      .insert(rows)
      .select(TASK_COLUMNS);

    if (insertError) {
      taskError("task DB insert failed", insertError, {
        meetingId,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        rowsAttempted: rows.length,
      });
      throw new Error(`Failed to save tasks: ${insertError.message}`);
    }

    const insertedRecords = (inserted ?? [])
      .map((row) => mapMeetingTaskRow(row as Record<string, unknown>))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (insertedRecords.length > 0) {
      await insertTaskStatusEvents(
        supabase,
        insertedRecords.map((record) => ({
          taskId: record.id,
          meetingId: record.meeting_id,
          fromStatus: null,
          toStatus: "pending",
          source: "extraction",
        })),
      );
    }

    const insertedCount = insertedRecords.length || rows.length;
    taskLog("task DB insert success", {
      meetingId,
      insertedCount,
      insertedIds: insertedRecords.map((record) => record.id),
    });

    taskLog("final task pipeline status: success", {
      meetingId,
      insertedCount,
      extractedCount: extracted.length,
    });

    await maybeTriggerRemindersAfterTasks(supabase, meetingId, "post-extraction-insert");

    return { success: true, insertedCount, extractedCount: extracted.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task extraction failed";
    taskError("final task pipeline status: failed", error, { meetingId, message });
    return {
      success: false,
      insertedCount: 0,
      extractedCount: 0,
      error: message,
    };
  }
}
