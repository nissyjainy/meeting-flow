import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { taskError, taskLog } from "./task-extraction-debug";

const ExtractMeetingTasksInput = z.object({
  meetingId: z.string().uuid(),
});

function parseTaskExtractionInput(raw: unknown): z.infer<typeof ExtractMeetingTasksInput> {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.meetingId === "string") {
      return ExtractMeetingTasksInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return ExtractMeetingTasksInput.parse(obj.data);
    }
  }
  return ExtractMeetingTasksInput.parse(raw);
}

export const extractMeetingTasksFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    taskLog("task extraction inputValidator started");
    try {
      const parsed = parseTaskExtractionInput(raw);
      taskLog("task extraction inputValidator success", { meetingId: parsed.meetingId });
      return parsed;
    } catch (error) {
      taskError("task extraction inputValidator failed", error, { raw });
      throw error;
    }
  })
  .handler(async ({ data }) => {
    taskLog("task extraction server handler invoked", { meetingId: data.meetingId });

    const { runMeetingTaskExtractionPipeline } = await import("./task-extraction-pipeline.server");
    const outcome = await runMeetingTaskExtractionPipeline(data.meetingId);

    taskLog("task extraction server handler finished", {
      meetingId: data.meetingId,
      success: outcome.success,
      insertedCount: outcome.insertedCount,
      extractedCount: outcome.extractedCount,
      error: outcome.error ?? null,
    });

    return {
      success: outcome.success,
      insertedCount: outcome.insertedCount,
      extractedCount: outcome.extractedCount,
      error: outcome.error,
    };
  });
