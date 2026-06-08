import type { SupabaseClient } from "@supabase/supabase-js";
import { MEETINGS_BUCKET } from "./constants";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "./upload-debug";
import { mimeTypeFromFileName, normalizeMeetingMimeType, sanitizeStorageFileName } from "./validation";

export function buildMeetingStoragePath(
  userId: string,
  meetingId: string,
  fileName: string,
): string {
  uploadDebug("buildMeetingStoragePath started", { userId, meetingId, fileName });

  try {
    if (!userId?.trim()) {
      throw new Error("User id is required to build a storage path.");
    }
    if (!meetingId?.trim()) {
      throw new Error("Meeting id is required to build a storage path.");
    }
    if (!fileName?.trim()) {
      throw new Error("File name is required to build a storage path.");
    }
    const path = `${userId}/${meetingId}/${sanitizeStorageFileName(fileName)}`;
    return uploadDebugReturn("buildMeetingStoragePath success", path, { path });
  } catch (error) {
    uploadDebugError("buildMeetingStoragePath failed", error);
    throw error;
  }
}

type UploadOptions = {
  supabase: SupabaseClient;
  file: File;
  path: string;
  onProgress?: (percent: number) => void;
};

/**
 * Upload via Supabase Storage SDK so the authenticated session JWT is attached.
 */
export async function uploadMeetingFile({
  supabase,
  file,
  path,
  onProgress,
}: UploadOptions): Promise<void> {
  uploadDebug("upload started (storage)", {
    path,
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
    bucket: MEETINGS_BUCKET,
  });

  try {
    if (!supabase) {
      throw new Error("Supabase client is required for upload.");
    }
    if (!file) {
      throw new Error("File is required for upload.");
    }
    if (!path?.trim()) {
      throw new Error("Storage path is required for upload.");
    }

    onProgress?.(0);

    const { error } = await supabase.storage.from(MEETINGS_BUCKET).upload(path, file, {
      contentType: normalizeMeetingMimeType(file.type, file.name),
      upsert: false,
    });

    if (error) {
      uploadDebugError("upload failed (storage SDK)", error, { path });
      throw new Error(error.message);
    }

    onProgress?.(100);
    uploadDebug("upload success (storage)", { path });
    return uploadDebugReturn("uploadMeetingFile success", undefined, { path });
  } catch (error) {
    uploadDebugError("uploadMeetingFile catch", error, { path });
    throw error;
  }
}
