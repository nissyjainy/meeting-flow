import type { SupabaseClient } from "@supabase/supabase-js";
import { MEETINGS_BUCKET } from "./constants";
import { enrichMeetingRecord } from "./record";
import type { MeetingRecord } from "./types";
import { buildMeetingStoragePath } from "./storage";
import { uploadDebug, uploadDebugError } from "./upload-debug";
import { normalizeMeetingMimeType, validateMeetingFile } from "./validation";

export type CaptureUploadMetadata = {
  meetUrl?: string | null;
  meetTitle?: string | null;
  source?: "chrome_extension";
};

export type CaptureUploadInput = {
  supabase: SupabaseClient;
  userId: string;
  file: File;
  metadata?: CaptureUploadMetadata;
};

export type CaptureUploadResult = {
  meeting: MeetingRecord;
  storagePath: string;
  metadata: CaptureUploadMetadata & {
    meetingId: string;
    fileName: string;
    capturedAt: string;
  };
};

export async function uploadCapturedMeetingRecording(
  input: CaptureUploadInput,
): Promise<CaptureUploadResult> {
  const { supabase, userId, file, metadata = {} } = input;

  uploadDebug("capture upload started", {
    userId,
    fileName: file.name,
    fileSize: file.size,
    meetUrl: metadata.meetUrl ?? null,
  });

  const validation = validateMeetingFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const meetingId = crypto.randomUUID();
  const storagePath = buildMeetingStoragePath(userId, meetingId, file.name);

  const { error: storageError } = await supabase.storage.from(MEETINGS_BUCKET).upload(storagePath, file, {
    contentType: normalizeMeetingMimeType(file.type, file.name),
    upsert: false,
  });

  if (storageError) {
    uploadDebugError("capture storage upload failed", storageError, { storagePath });
    throw new Error(storageError.message);
  }

  const { data: record, error: insertError } = await supabase
    .from("meetings")
    .insert({
      id: meetingId,
      file_name: file.name,
      file_url: storagePath,
      transcript: null,
      status: "processing",
    })
    .select("id,file_name,file_url,transcript,summary,status,transcript_error,created_at")
    .single();

  if (insertError) {
    uploadDebugError("capture meeting insert failed", insertError, { meetingId, storagePath });
    try {
      await supabase.storage.from(MEETINGS_BUCKET).remove([storagePath]);
    } catch (cleanupError) {
      uploadDebugError("capture storage cleanup failed", cleanupError, { storagePath });
    }
    throw new Error(insertError.message);
  }

  const capturedAt = new Date().toISOString();
  const result: CaptureUploadResult = {
    meeting: enrichMeetingRecord(record),
    storagePath,
    metadata: {
      ...metadata,
      source: metadata.source ?? "chrome_extension",
      meetingId,
      fileName: file.name,
      capturedAt,
      meetUrl: metadata.meetUrl ?? null,
      meetTitle: metadata.meetTitle ?? null,
    },
  };

  uploadDebug("capture upload success", { meetingId, storagePath });
  return result;
}
