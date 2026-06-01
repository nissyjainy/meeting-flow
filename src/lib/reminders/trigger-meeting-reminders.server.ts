import { reminderError, reminderLog } from "./reminder-debug";
import { logReminderEnvStatus } from "./reminder-env";
import { runMeetingTaskReminderEmails } from "./task-reminder-pipeline.server";
import type { TaskReminderPipelineOutcome } from "./task-reminder-pipeline.server";

export async function triggerMeetingTaskReminders(
  meetingId: string,
  reason: string,
): Promise<TaskReminderPipelineOutcome> {
  reminderLog("reminder pipeline trigger", { meetingId, reason });
  logReminderEnvStatus(reason);

  try {
    const outcome = await runMeetingTaskReminderEmails(meetingId, reason);
    reminderLog("final reminder status", {
      meetingId,
      reason,
      success: outcome.success,
      sent: outcome.sent,
      skippedReason: outcome.skippedReason ?? null,
      error: outcome.error ?? null,
      counts: outcome.counts ?? null,
    });
    return outcome;
  } catch (error) {
    reminderError("reminder trigger failed (non-fatal)", error, { meetingId, reason });
    return {
      success: false,
      sent: false,
      error: error instanceof Error ? error.message : "Reminder trigger failed",
    };
  }
}
