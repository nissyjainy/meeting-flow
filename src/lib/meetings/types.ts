/** Row shape returned from Supabase `meetings` table. */
export type MeetingRecordRow = {
  id: string;
  file_name: string;
  file_url: string;
  transcript: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

/** Enriched record used by existing UI components. */
export type MeetingRecord = MeetingRecordRow & {
  title: string;
  /** UI status; maps DB `completed` → `ready` */
  status: "processing" | "ready" | "failed";
  mime_type: string;
  file_path: string;
  transcript_text: string | null;
  transcript_status: "queued" | "transcribing" | "completed" | "failed";
  transcript_error: string | null;
  file_size: number | null;
};

export type UploadPhase =
  | "idle"
  | "validating"
  | "uploading"
  | "saving"
  | "transcribing"
  | "complete"
  | "error";

export type UploadAiOutcome = null | "complete" | "partial";

export type MeetingUploadState = {
  phase: UploadPhase;
  progress: number;
  error: string | null;
  fileName: string | null;
  aiOutcome: UploadAiOutcome;
  aiWarning: string | null;
};

import type { StoredTaskStatus } from "./task-status";

/** Row shape from Supabase `tasks` table (extracted action items). */
export type MeetingTaskRecord = {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  status: StoredTaskStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};
