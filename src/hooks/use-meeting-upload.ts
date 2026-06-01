import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createMeetingRecord, transcribeMeeting } from "@/lib/meetings/api";
import { MEETINGS_BUCKET } from "@/lib/meetings/constants";
import { buildMeetingStoragePath, uploadMeetingFile } from "@/lib/meetings/storage";
import type { MeetingRecord, MeetingUploadState } from "@/lib/meetings/types";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "@/lib/meetings/upload-debug";
import { formatUploadError } from "@/lib/meetings/upload-errors";
import { isUploadProcessingPhase } from "@/lib/meetings/upload-status";
import { validateMeetingFile } from "@/lib/meetings/validation";
import { meetingsQueryKey } from "./use-meetings";

const initialState: MeetingUploadState = {
  phase: "idle",
  progress: 0,
  error: null,
  fileName: null,
  aiOutcome: null,
  aiWarning: null,
};

const AI_PARTIAL_WARNING =
  "Upload saved, but AI summary or action items could not be fully generated. Open the meeting from your list to review the transcript and status.";

export function useMeetingUpload() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MeetingUploadState>(initialState);

  const setUploadState = useCallback(
    (next: MeetingUploadState | ((prev: MeetingUploadState) => MeetingUploadState), reason: string) => {
      setState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        uploadDebug("state transition", {
          reason,
          from: prev.phase,
          to: resolved.phase,
          progress: resolved.progress,
        });
        return resolved;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    uploadDebug("reset() called", { previousPhase: state.phase });
    setState(initialState);
    uploadDebug("reset() complete → idle");
  }, [state.phase]);

  const upload = useCallback(
    async (file: File): Promise<MeetingRecord | null> => {
      uploadDebug("upload() started (hook)", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      try {
        const validation = validateMeetingFile(file);
        if (!validation.valid) {
          uploadDebugError("validation failed (hook)", new Error(validation.message));
          setUploadState(
            {
              phase: "error",
              progress: 0,
              error: validation.message,
              fileName: file.name,
              aiOutcome: null,
              aiWarning: null,
            },
            "validation failed",
          );
          return uploadDebugReturn("upload() return null", null, { reason: "validation failed" });
        }

        setUploadState(
          {
            phase: "validating",
            progress: 5,
            error: null,
            fileName: file.name,
            aiOutcome: null,
            aiWarning: null,
          },
          "validation passed",
        );

        const supabase = createClient();
        uploadDebug("auth getUser started (hook)");

        let user: { id: string } | null = null;
        try {
          const {
            data: { user: authUser },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !authUser) {
            const err = userError ?? new Error("No user session");
            uploadDebugError("auth getUser failed (hook)", err);
            setUploadState(
              {
                phase: "error",
                progress: 0,
                error: "You must be signed in to upload.",
                fileName: file.name,
                aiOutcome: null,
                aiWarning: null,
              },
              "auth failed",
            );
            return uploadDebugReturn("upload() return null", null, { reason: "not signed in" });
          }

          user = authUser;
          uploadDebug("auth getUser success (hook)", { userId: user.id });
        } catch (error) {
          uploadDebugError("auth getUser catch (hook)", error);
          setUploadState(
            {
              phase: "error",
              progress: 0,
              error: formatUploadError(error, "upload"),
              fileName: file.name,
              aiOutcome: null,
              aiWarning: null,
            },
            "auth catch",
          );
          return uploadDebugReturn("upload() return null", null, { reason: "auth catch" });
        }

        try {
          uploadDebug("auth refreshSession started (hook)");
          await supabase.auth.refreshSession();
          uploadDebug("auth refreshSession success (hook)");
        } catch (error) {
          uploadDebugError("auth refreshSession catch (hook)", error);
          throw error;
        }

        const meetingId = crypto.randomUUID();
        let storagePath: string;
        try {
          storagePath = buildMeetingStoragePath(user.id, meetingId, file.name);
          uploadDebug("storage path built (hook)", { meetingId, storagePath });
        } catch (error) {
          uploadDebugError("buildMeetingStoragePath catch (hook)", error);
          setUploadState(
            {
              phase: "error",
              progress: 0,
              error: formatUploadError(error, "upload"),
              fileName: file.name,
              aiOutcome: null,
              aiWarning: null,
            },
            "storage path failed",
          );
          return uploadDebugReturn("upload() return null", null, { reason: "storage path" });
        }

        let recordId: string | null = null;

        try {
          setUploadState(
            (s) => ({ ...s, phase: "uploading", progress: 0 }),
            "uploading phase",
          );

          uploadDebug("upload started (hook → storage)", { storagePath });
          try {
            await uploadMeetingFile({
              supabase,
              file,
              path: storagePath,
              onProgress: (percent) => {
                uploadDebug("upload progress (hook)", { percent });
                setState((s) => ({
                  ...s,
                  phase: "uploading",
                  progress: percent,
                }));
              },
            });
            uploadDebug("upload success (hook)");
          } catch (error) {
            uploadDebugError("upload catch (hook)", error, { storagePath });
            throw error;
          }

          setUploadState(
            (s) => ({ ...s, phase: "saving", progress: 85 }),
            "saving phase",
          );

          uploadDebug("DB insert started (hook)");
          let record: MeetingRecord;
          try {
            record = await createMeetingRecord({
              meetingId,
              fileName: file.name,
              fileUrl: storagePath,
              transcript: null,
            });
            uploadDebug("DB insert success (hook)", { recordId: record.id });
          } catch (error) {
            uploadDebugError("DB insert catch (hook)", error, { meetingId, storagePath });
            throw error;
          }

          recordId = record.id;

          setUploadState(
            (s) => ({ ...s, phase: "transcribing", progress: 92 }),
            "transcribing phase",
          );

          uploadDebug("transcription started (hook)", { recordId: record.id });
          let aiOutcome: "complete" | "partial" = "partial";
          try {
            const transcriptionResult = await transcribeMeeting(record.id);
            aiOutcome = transcriptionResult.aiOutcome;
            uploadDebug("transcription success (hook)", { recordId: record.id, aiOutcome });
          } catch (error) {
            uploadDebugError("transcription catch (hook)", error, { recordId: record.id });
            setUploadState(
              {
                phase: "error",
                progress: 100,
                error: formatUploadError(error, "transcription"),
                fileName: file.name,
                aiOutcome: null,
                aiWarning: null,
              },
              "transcription failed",
            );
            try {
              uploadDebug("invalidateQueries started (hook, transcription error)");
              await queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
              uploadDebug("invalidateQueries success (hook, transcription error)");
            } catch (invalidateError) {
              uploadDebugError("invalidateQueries catch (hook, transcription error)", invalidateError);
            }
            return uploadDebugReturn("upload() return record (transcription failed)", record, {
              recordId: record.id,
            });
          }

          try {
            uploadDebug("invalidateQueries started (hook, success path)");
            await queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
            uploadDebug("invalidateQueries success (hook, success path)");
          } catch (error) {
            uploadDebugError("invalidateQueries catch (hook, success path)", error);
          }

          setUploadState(
            {
              phase: "complete",
              progress: 100,
              error: null,
              fileName: file.name,
              aiOutcome,
              aiWarning:
                aiOutcome === "complete"
                  ? null
                  : AI_PARTIAL_WARNING,
            },
            "complete",
          );

          uploadDebug("upload pipeline complete (hook)", { recordId: record.id });
          return uploadDebugReturn("upload() return record (success)", record, {
            recordId: record.id,
          });
        } catch (error) {
          uploadDebugError("upload pipeline catch (hook)", error, { recordId, storagePath });

          if (!recordId) {
            try {
              uploadDebug("storage cleanup started (hook)", { storagePath });
              await supabase.storage.from(MEETINGS_BUCKET).remove([storagePath]);
              uploadDebug("storage cleanup success (hook)", { storagePath });
            } catch (cleanupError) {
              uploadDebugError("storage cleanup catch (hook)", cleanupError, { storagePath });
            }
          }

          setUploadState(
            {
              phase: "error",
              progress: recordId ? 100 : 0,
              error: formatUploadError(error, "upload"),
              fileName: file.name,
              aiOutcome: null,
              aiWarning: null,
            },
            "pipeline catch",
          );
          return uploadDebugReturn("upload() return null (pipeline catch)", null, {
            recordId,
            error: formatUploadError(error, "upload"),
          });
        }
      } catch (error) {
        uploadDebugError("upload() outer catch (hook)", error);
        setUploadState(
          {
            phase: "error",
            progress: 0,
            error: formatUploadError(error, "upload"),
            fileName: file.name,
            aiOutcome: null,
            aiWarning: null,
          },
          "outer catch",
        );
        return uploadDebugReturn("upload() return null (outer catch)", null, {
          error: formatUploadError(error, "upload"),
        });
      }
    },
    [queryClient, setUploadState],
  );

  const isProcessing = isUploadProcessingPhase(state.phase);

  return {
    state,
    upload,
    reset,
    isProcessing,
    /** @deprecated Use isProcessing */
    isUploading: isProcessing,
  };
}
