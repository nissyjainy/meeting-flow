import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reminderError, reminderLog } from "./reminder-debug";
import { logReminderEnvStatus } from "./reminder-env";

const MeetingReminderInput = z.object({
  meetingId: z.string().uuid(),
});

function parseMeetingReminderInput(raw: unknown): z.infer<typeof MeetingReminderInput> {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.meetingId === "string") {
      return MeetingReminderInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return MeetingReminderInput.parse(obj.data);
    }
  }
  return MeetingReminderInput.parse(raw);
}

/** Manual test: send reminder email for one meeting immediately. */
export const sendMeetingRemindersFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    reminderLog("TEST sendMeetingRemindersFn — inputValidator");
    logReminderEnvStatus("sendMeetingRemindersFn");
    return parseMeetingReminderInput(raw);
  })
  .handler(async ({ data }) => {
    reminderLog("TEST sendMeetingRemindersFn — handler started", { meetingId: data.meetingId });
    const { triggerMeetingTaskReminders } = await import("./trigger-meeting-reminders.server");
    const outcome = await triggerMeetingTaskReminders(data.meetingId, "manual-test");
    const { getResendEnvDiagnostics } = await import("@/lib/server-env");
    return {
      ...outcome,
      envDiagnostics: getResendEnvDiagnostics(),
    };
  });

/** Manual test: run scheduled digest (all users with pending tasks). */
export const sendScheduledRemindersFn = createServerFn({ method: "POST" })
  .handler(async () => {
    reminderLog("TEST sendScheduledRemindersFn — handler started");
    logReminderEnvStatus("sendScheduledRemindersFn");
    try {
      const { runScheduledTaskReminderEmails } = await import("./task-reminder-pipeline.server");
      const result = await runScheduledTaskReminderEmails();
      reminderLog("TEST sendScheduledRemindersFn — finished", result);
      return result;
    } catch (error) {
      reminderError("TEST sendScheduledRemindersFn — failed", error);
      throw error;
    }
  });
