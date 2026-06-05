import type { SupabaseClient } from "@supabase/supabase-js";
import { transcriptionError, transcriptionLog } from "./transcription-debug";

export async function markTranscriptionFailed(
  supabase: SupabaseClient,
  meetingId: string,
  reason: string,
): Promise<void> {
  const message = reason.trim() || "Transcription failed";
  transcriptionLog("status update → failed", { meetingId, reason: message });

  const { error, data } = await supabase
    .from("meetings")
    .update({ status: "failed", transcript_error: message })
    .eq("id", meetingId)
    .select("id,status,transcript_error")
    .maybeSingle();

  if (error) {
    transcriptionError("status update failed (could not set failed)", error, {
      meetingId,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }

  transcriptionLog("status update success (failed)", { meetingId, row: data });
}
