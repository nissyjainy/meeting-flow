import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldReplaceTitleWithAiGeneratedTitle } from "./resolve-capture-title";
import { summaryError, summaryLog } from "./summary-debug";
import { generateMeetingTitleFromTranscript, sanitizeMeetingTitle } from "./title-groq";

export type AiTitleOutcome = {
  replaced: boolean;
  title?: string;
  skippedReason?: string;
};

export async function persistAiMeetingTitleIfNeeded(
  supabase: SupabaseClient,
  meetingId: string,
  transcript: string,
  currentTitle: string | null | undefined,
  meetingCode: string | null | undefined,
): Promise<AiTitleOutcome> {
  if (!shouldReplaceTitleWithAiGeneratedTitle(currentTitle, meetingCode)) {
    const skippedReason = "existing title is user-friendly or calendar-derived";
    summaryLog("AI title skipped", {
      meetingId,
      currentTitle,
      meetingCode,
      skippedReason,
    });
    return { replaced: false, skippedReason };
  }

  try {
    const rawTitle = await generateMeetingTitleFromTranscript(transcript);
    const title = sanitizeMeetingTitle(rawTitle);
    if (!title) {
      summaryLog("AI title skipped — empty after sanitization", { meetingId });
      return { replaced: false, skippedReason: "empty after sanitization" };
    }

    const { error } = await supabase.from("meetings").update({ title }).eq("id", meetingId);

    if (error) {
      summaryError("AI title DB update failed (non-fatal)", error, { meetingId });
      return { replaced: false, skippedReason: "db update failed" };
    }

    summaryLog("AI title persisted", { meetingId, title, previousTitle: currentTitle });
    return { replaced: true, title };
  } catch (error) {
    summaryError("AI title generation failed (non-fatal)", error, { meetingId });
    return { replaced: false, skippedReason: "generation failed" };
  }
}
