import type { MeetingRecord } from "./types";

/** User-facing pipeline state derived from stored meeting fields. */
export type MeetingPipelineDisplay = "processing" | "completed" | "failed";

export function getPipelineDisplayStatus(meeting: MeetingRecord): MeetingPipelineDisplay {
  if (meeting.status === "failed") return "failed";
  if (meeting.status === "processing") return "processing";
  if (meeting.status === "ready") return "completed";
  return "processing";
}

export function hasTranscript(meeting: MeetingRecord): boolean {
  return Boolean(meeting.transcript_text?.trim());
}

export function hasSummary(meeting: MeetingRecord): boolean {
  return Boolean(meeting.summary?.trim());
}

export function summaryFallback(meeting: MeetingRecord): string {
  const pipeline = getPipelineDisplayStatus(meeting);
  if (pipeline === "failed") {
    return "Summary could not be generated. The transcript may still be available below.";
  }
  if (pipeline === "processing") {
    return hasTranscript(meeting)
      ? "Transcript is ready. Generating AI summary…"
      : "Processing your recording. Summary will appear when ready.";
  }
  return "No summary available for this meeting.";
}

export function transcriptFallback(meeting: MeetingRecord): string {
  const pipeline = getPipelineDisplayStatus(meeting);
  if (pipeline === "failed") {
    return "Transcription failed or is unavailable.";
  }
  if (pipeline === "processing") {
    return "Transcript is being generated. Check back in a moment.";
  }
  return "No transcript available for this meeting.";
}
