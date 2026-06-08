import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { markTranscriptionFailed } from "./mark-transcription-failed.server";
import { runMeetingSummaryPipeline } from "./summary-pipeline.server";
import { runTranscribeMeeting } from "./transcription";
import { uploadDebug, uploadDebugError } from "./upload-debug";

/** Runs transcription + summary using the service role (extension / background jobs). */
export async function runMeetingAiPipeline(meetingId: string): Promise<void> {
  uploadDebug("runMeetingAiPipeline started", { meetingId });

  const admin = getSupabaseAdminClient();
  if (!admin) {
    uploadDebugError(
      "runMeetingAiPipeline skipped — no SUPABASE_SERVICE_ROLE_KEY",
      new Error("Missing service role key"),
      { meetingId },
    );
    return;
  }

  try {
    await runTranscribeMeeting(meetingId, admin);
    uploadDebug("runMeetingAiPipeline transcription done", { meetingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    uploadDebugError("runMeetingAiPipeline transcription failed", error, { meetingId });
    try {
      await markTranscriptionFailed(admin, meetingId, message);
    } catch (markErr) {
      uploadDebugError("runMeetingAiPipeline markTranscriptionFailed threw", markErr, { meetingId });
    }
    return;
  }

  try {
    const summaryOutcome = await runMeetingSummaryPipeline(meetingId, admin);
    if (!summaryOutcome.success) {
      uploadDebugError(
        "runMeetingAiPipeline summary failed",
        new Error(summaryOutcome.error ?? "Summary failed"),
        { meetingId },
      );
      return;
    }
    uploadDebug("runMeetingAiPipeline summary done", { meetingId });
  } catch (error) {
    uploadDebugError("runMeetingAiPipeline summary failed", error, { meetingId });
  }
}
