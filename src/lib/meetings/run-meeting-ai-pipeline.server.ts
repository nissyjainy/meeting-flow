import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
    uploadDebugError("runMeetingAiPipeline transcription failed", error, { meetingId });
    return;
  }

  try {
    await runMeetingSummaryPipeline(meetingId);
    uploadDebug("runMeetingAiPipeline summary done", { meetingId });
  } catch (error) {
    uploadDebugError("runMeetingAiPipeline summary failed", error, { meetingId });
  }
}
