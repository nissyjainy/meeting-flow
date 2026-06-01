import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summaryError, summaryLog } from "./summary-debug";

const GenerateMeetingSummaryInput = z.object({
  meetingId: z.string().uuid(),
});

function parseSummaryInput(raw: unknown): z.infer<typeof GenerateMeetingSummaryInput> {
  summaryLog("parseSummaryInput", {
    rawType: typeof raw,
    rawKeys: raw && typeof raw === "object" ? Object.keys(raw as object) : null,
  });

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.meetingId === "string") {
      return GenerateMeetingSummaryInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return GenerateMeetingSummaryInput.parse(obj.data);
    }
  }

  return GenerateMeetingSummaryInput.parse(raw);
}

export const generateMeetingSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    summaryLog("summary inputValidator started (server)");
    try {
      const parsed = parseSummaryInput(raw);
      summaryLog("summary inputValidator success (server)", { meetingId: parsed.meetingId });
      return parsed;
    } catch (error) {
      summaryError("summary inputValidator failed (server)", error, { raw });
      throw error;
    }
  })
  .handler(async ({ data }) => {
    summaryLog("summary handler invoked (server)", { meetingId: data.meetingId });

    try {
      const { runMeetingSummaryPipeline } = await import("./summary-pipeline.server");
      const outcome = await runMeetingSummaryPipeline(data.meetingId);

      if (!outcome.success) {
        const err = new Error(outcome.error ?? "Summary generation failed");
        summaryError("summary handler returning failure", err, { meetingId: data.meetingId });
        throw err;
      }

      summaryLog("summary handler success (server)", {
        meetingId: data.meetingId,
        summaryLength: outcome.summary?.length ?? 0,
        taskExtraction: outcome.taskOutcome
          ? {
              success: outcome.taskOutcome.success,
              insertedCount: outcome.taskOutcome.insertedCount,
              extractedCount: outcome.taskOutcome.extractedCount,
              error: outcome.taskOutcome.error ?? null,
            }
          : null,
      });

      return {
        summary: outcome.summary!,
        tasks: outcome.taskOutcome
          ? {
              insertedCount: outcome.taskOutcome.insertedCount,
              extractedCount: outcome.taskOutcome.extractedCount,
              success: outcome.taskOutcome.success,
            }
          : undefined,
      };
    } catch (error) {
      summaryError("summary handler catch (server)", error, { meetingId: data.meetingId });
      throw error;
    }
  });
