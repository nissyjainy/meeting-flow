import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/task-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { reminderLog } = await import("@/lib/reminders/reminder-debug");
        const { getReminderConfig, logReminderEnvStatus } = await import(
          "@/lib/reminders/reminder-env"
        );
        const { runScheduledTaskReminderEmails } = await import(
          "@/lib/reminders/task-reminder-pipeline.server"
        );

        reminderLog("scheduler triggered — POST /api/cron/task-reminders");
        logReminderEnvStatus("api-cron");

        const config = getReminderConfig();
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const isDev = import.meta.env.DEV;

        if (config.cronSecret) {
          if (token !== config.cronSecret) {
            reminderLog("scheduler rejected — invalid CRON_SECRET");
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        } else if (!isDev) {
          reminderLog("scheduler rejected — CRON_SECRET required outside dev");
          return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
        } else {
          reminderLog("scheduler running in dev without CRON_SECRET");
        }

        const result = await runScheduledTaskReminderEmails();
        reminderLog("scheduler finished", result);
        return Response.json(result);
      },
    },
  },
});
