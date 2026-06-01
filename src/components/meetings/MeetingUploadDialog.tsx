import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeetingUploadDropzone } from "./MeetingUploadDropzone";
import type { MeetingRecord, MeetingUploadState } from "@/lib/meetings/types";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "@/lib/meetings/upload-debug";

type MeetingUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: MeetingUploadState;
  upload: (file: File) => Promise<MeetingRecord | null>;
  reset: () => void;
  isProcessing: boolean;
  onUploaded?: () => void | Promise<void>;
};

export function MeetingUploadDialog({
  open,
  onOpenChange,
  state,
  upload,
  reset,
  isProcessing,
  onUploaded,
}: MeetingUploadDialogProps) {
  const handleOpenChange = (next: boolean) => {
    uploadDebug("MeetingUploadDialog handleOpenChange", { next, isProcessing, phase: state.phase });
    if (!next && isProcessing) {
      uploadDebug("MeetingUploadDialog handleOpenChange blocked (processing)");
      return;
    }
    if (!next) {
      uploadDebug("MeetingUploadDialog handleOpenChange → reset() on manual close", {
        phase: state.phase,
      });
      reset();
    }
    onOpenChange(next);
    uploadDebug("MeetingUploadDialog handleOpenChange complete", { next });
  };

  const handleFileSelected = async (file: File) => {
    uploadDebug("MeetingUploadDialog handleFileSelected started", {
      fileName: file.name,
      fileSize: file.size,
    });

    try {
      const record = await upload(file);
      uploadDebug("MeetingUploadDialog handleFileSelected upload() returned", {
        hasRecord: Boolean(record),
        recordId: record?.id ?? null,
        phaseAfterUpload: state.phase,
      });

      if (record) {
        try {
          uploadDebug("MeetingUploadDialog onUploaded callback started");
          await onUploaded?.();
          uploadDebug("MeetingUploadDialog onUploaded callback success");
        } catch (error) {
          uploadDebugError("MeetingUploadDialog onUploaded callback catch", error);
        }
      } else {
        uploadDebug("MeetingUploadDialog handleFileSelected — no record returned (null)");
      }

      return uploadDebugReturn("MeetingUploadDialog handleFileSelected complete", undefined, {
        recordId: record?.id ?? null,
      });
    } catch (error) {
      uploadDebugError("MeetingUploadDialog handleFileSelected catch", error);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => isProcessing && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Upload recording</DialogTitle>
          <DialogDescription>
            Add an audio or video file from your device. Supported formats: mp3, mp4, wav, m4a.
          </DialogDescription>
        </DialogHeader>
        <MeetingUploadDropzone
          state={state}
          isProcessing={isProcessing}
          onFileSelected={handleFileSelected}
          onReset={reset}
        />
      </DialogContent>
    </Dialog>
  );
}
