import { mimeTypeFromFileName, titleFromFileName } from "./validation";
import type { MeetingRecord, MeetingRecordRow } from "./types";

function mapDbStatusToUi(dbStatus: string | null | undefined): MeetingRecord["status"] {
  if (dbStatus === "completed") return "ready";
  if (dbStatus === "failed") return "failed";
  if (dbStatus === "processing") return "processing";
  return "processing";
}

export function enrichMeetingRecord(row: MeetingRecordRow): MeetingRecord {
  const hasTranscript = Boolean(row.transcript?.trim());
  const uiStatus = mapDbStatusToUi(row.status);
  const transcriptError = (row.transcript_error ?? null)?.trim() || null;

  return {
    ...row,
    summary: row.summary ?? null,
    status: uiStatus,
    title: row.title?.trim() || titleFromFileName(row.file_name),
    mime_type: mimeTypeFromFileName(row.file_name),
    file_path: row.file_url,
    transcript_text: row.transcript,
    transcript_status: hasTranscript
      ? "completed"
      : uiStatus === "failed"
        ? "failed"
        : "queued",
    transcript_error: transcriptError,
    file_size: null,
  };
}
