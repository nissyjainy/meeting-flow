import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runMeetingTaskExtractionPipeline } from "./task-extraction-pipeline.server";
import { generateMeetingSummaryFromTranscript } from "./summary-groq";
import { summaryError, summaryLog } from "./summary-debug";

async function markSummaryFailed(
  supabase: SupabaseClient,
  meetingId: string,
  reason: string,
): Promise<void> {
  summaryLog("final status update → failed", { meetingId, reason });

  const { error, data } = await supabase
    .from("meetings")
    .update({ status: "failed" })
    .eq("id", meetingId)
    .select("id,status,summary")
    .maybeSingle();

  if (error) {
    summaryError("final status update failed (could not set failed)", error, {
      meetingId,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }

  summaryLog("final status update success (failed)", { meetingId, row: data });
}

async function persistSummaryOnly(
  supabase: SupabaseClient,
  meetingId: string,
  summary: string,
): Promise<void> {
  summaryLog("summary DB update started", { meetingId, summaryLength: summary.length });

  const { error: saveSummaryError, data: summaryRow } = await supabase
    .from("meetings")
    .update({ summary, status: "processing" })
    .eq("id", meetingId)
    .select("id,summary,status")
    .maybeSingle();

  if (saveSummaryError) {
    summaryError("summary DB update failed", saveSummaryError, {
      meetingId,
      code: saveSummaryError.code,
      details: saveSummaryError.details,
      hint: saveSummaryError.hint,
    });
    throw new Error(`Failed to save summary: ${saveSummaryError.message}`);
  }

  summaryLog("summary DB update success (pipeline still processing)", { meetingId, row: summaryRow });
}

async function markPipelineComplete(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<void> {
  summaryLog("final status update → completed", { meetingId });

  const { error: statusError, data: statusRow } = await supabase
    .from("meetings")
    .update({ status: "completed" })
    .eq("id", meetingId)
    .select("id,summary,status")
    .maybeSingle();

  if (statusError) {
    summaryError("final status update failed (completed)", statusError, {
      meetingId,
      code: statusError.code,
      details: statusError.details,
      hint: statusError.hint,
    });
    throw new Error(`Failed to set status completed: ${statusError.message}`);
  }

  summaryLog("final status update success (completed)", { meetingId, row: statusRow });
}

export async function runMeetingSummaryPipeline(meetingId: string): Promise<{
  success: boolean;
  summary?: string;
  error?: string;
  taskOutcome?: Awaited<ReturnType<typeof runMeetingTaskExtractionPipeline>>;
}> {
  summaryLog("summary started (pipeline)", { meetingId });

  const supabase = getSupabaseServerClient();

  try {
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id,transcript,summary,status")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError) {
      throw new Error(`Fetch meeting failed: ${meetingError.message}`);
    }
    if (!meeting) {
      throw new Error("Meeting not found.");
    }
    if (!meeting.transcript?.trim()) {
      throw new Error("Meeting has no transcript to summarize.");
    }

    summaryLog("meeting loaded for summary", {
      meetingId,
      transcriptLength: meeting.transcript.length,
      existingSummary: Boolean(meeting.summary?.trim()),
      currentStatus: meeting.status,
    });

    const summary = await generateMeetingSummaryFromTranscript(meeting.transcript);
    summaryLog("summary success (Groq)", { meetingId, summaryLength: summary.length });

    await persistSummaryOnly(supabase, meetingId, summary);

    summaryLog("starting post-summary task extraction", { meetingId });
    const taskOutcome = await runMeetingTaskExtractionPipeline(
      meetingId,
      meeting.transcript,
    );
    summaryLog("task extraction finished (post-summary)", {
      meetingId,
      insertedCount: taskOutcome.insertedCount,
      extractedCount: taskOutcome.extractedCount,
      success: taskOutcome.success,
      error: taskOutcome.error ?? null,
    });

    await markPipelineComplete(supabase, meetingId);

    summaryLog("summary pipeline complete", { meetingId });
    return { success: true, summary, taskOutcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Summary generation failed";
    summaryError("summary failed (pipeline)", error, { meetingId });

    try {
      await markSummaryFailed(supabase, meetingId, message);
    } catch (markErr) {
      summaryError("markSummaryFailed threw", markErr, { meetingId });
    }

    return { success: false, error: message };
  }
}
