import type { SupabaseClient } from "@supabase/supabase-js";
import { MEETINGS_BUCKET } from "./constants";
import { findCalendarEventTitleForCapture } from "./find-calendar-event-for-capture.server";
import { enrichMeetingRecord } from "./record";
import type { MeetingRecord } from "./types";
import { buildMeetingStoragePath } from "./storage";
import { uploadDebug, uploadDebugError } from "./upload-debug";
import { normalizeMeetingMimeType, validateMeetingFile } from "./validation";
import {
  resolveCaptureMeetingCode,
  resolveCaptureTitle,
  resolveMeetingPlatform,
} from "./resolve-capture-title";

export type CaptureUploadMetadata = {
  meetUrl?: string | null;
  meetTitle?: string | null;
  tabTitle?: string | null;
  platform?: string | null;
  meetingCode?: string | null;
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

  const meetUrl = metadata.meetUrl?.trim() || null;
  const meetingCode = resolveCaptureMeetingCode(metadata.meetingCode, meetUrl);
  const platform = resolveMeetingPlatform(meetUrl, metadata.platform);
  const calendarTitle = await findCalendarEventTitleForCapture(supabase, userId, {
    meetUrl,
    meetingCode,
  });
  const title = resolveCaptureTitle({
    calendarTitle,
    tabTitle: metadata.tabTitle ?? metadata.meetTitle,
    meetTitle: metadata.meetTitle,
    meetingCode,
    meetUrl,
    platform,
  });

  uploadDebug("capture title resolved", {
    title,
    platform,
    meetingCode,
    meetUrl,
    calendarTitle,
    tabTitle: metadata.tabTitle ?? metadata.meetTitle ?? null,
  });

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
      title,
      platform,
      meeting_url: meetUrl,
      meeting_code: meetingCode,
    })
    .select(
      "id,file_name,file_url,transcript,summary,status,transcript_error,created_at,title,platform,meeting_url,meeting_code",
    )
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
      meetUrl,
      meetTitle: title,
      tabTitle: metadata.tabTitle ?? metadata.meetTitle ?? null,
      platform: metadata.platform ?? null,
      meetingCode,
    },
  };

  uploadDebug("capture upload success", { meetingId, storagePath });
  return result;
}
