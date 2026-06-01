import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileAudio, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPT_UPLOAD, ALLOWED_EXTENSIONS, MAX_MEETING_FILE_BYTES } from "@/lib/meetings/constants";
import { formatFileSize } from "@/lib/meetings/validation";
import {
  getUploadHeadline,
  getUploadPhaseLabel,
  getUploadProgressValue,
} from "@/lib/meetings/upload-status";
import type { MeetingUploadState } from "@/lib/meetings/types";
import { uploadDebug } from "@/lib/meetings/upload-debug";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

type MeetingUploadDropzoneProps = {
  state: MeetingUploadState;
  isProcessing: boolean;
  onFileSelected: (file: File) => void;
  onReset: () => void;
  className?: string;
};

export function MeetingUploadDropzone({
  state,
  isProcessing,
  onFileSelected,
  onReset,
  className,
}: MeetingUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      uploadDebug("MeetingUploadDropzone handleFiles", {
        fileCount: files?.length ?? 0,
        isProcessing,
        phase: state.phase,
      });
      const file = files?.[0];
      if (!file) {
        uploadDebug("MeetingUploadDropzone handleFiles → return (no file)");
        return;
      }
      if (isProcessing) {
        uploadDebug("MeetingUploadDropzone handleFiles → return (isProcessing)");
        return;
      }
      uploadDebug("MeetingUploadDropzone handleFiles → onFileSelected", {
        fileName: file.name,
        fileSize: file.size,
      });
      onFileSelected(file);
    },
    [isProcessing, onFileSelected, state.phase],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const phaseLabel = getUploadPhaseLabel(state);
  const headline = getUploadHeadline(state, isDragging);
  const progressValue = getUploadProgressValue(state);
  const showProgress = progressValue != null;
  const isSuccess = state.phase === "complete";
  const isError = state.phase === "error";

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="button"
        tabIndex={isProcessing ? -1 : 0}
        aria-disabled={isProcessing}
        aria-busy={isProcessing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isProcessing) inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!isProcessing) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isProcessing) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={onDrop}
        onClick={(e) => {
          if (isProcessing) return;
          if ((e.target as HTMLElement).closest("button")) return;
          inputRef.current?.click();
        }}
        className={cn(
          "relative flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          isProcessing ? "pointer-events-none opacity-80" : "cursor-pointer",
          isDragging && !isProcessing
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isError && "border-destructive/40",
          isSuccess && "border-success/40 bg-success/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_UPLOAD}
          className="sr-only"
          disabled={isProcessing}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {isProcessing ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        ) : isSuccess ? (
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        ) : isError ? (
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-primary/10">
            <Upload className="h-6 w-6 text-primary" aria-hidden />
          </div>
        )}

        <p className="mt-4 text-sm font-medium">{headline}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isProcessing || isSuccess || isError
            ? phaseLabel ?? "Please wait…"
            : `or click below to browse · ${ALLOWED_EXTENSIONS.join(", ")} · max ${formatFileSize(MAX_MEETING_FILE_BYTES)}`}
        </p>

        {!isProcessing && !isSuccess && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Choose file
          </Button>
        )}

        {state.fileName && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <FileAudio className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate font-medium">{state.fileName}</span>
          </div>
        )}
      </div>

      {showProgress && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
              {phaseLabel}
            </span>
            <span>{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      )}

      {isError && state.error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {isSuccess && state.aiOutcome === "partial" ? (
        <Alert className="border-warning/40 bg-warning/5 text-foreground" role="status">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription>
            {state.aiWarning ?? "AI processing partially failed. Open the meeting to review status."}
          </AlertDescription>
        </Alert>
      ) : isSuccess && state.aiOutcome === "complete" ? (
        <Alert className="border-success/30 bg-success/5 text-success" role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-success">
            AI processing completed. Your meeting is ready in the list.
          </AlertDescription>
        </Alert>
      ) : isSuccess ? (
        <Alert className="border-success/30 bg-success/5 text-success" role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-success">
            Upload successful. Your recording was saved.
          </AlertDescription>
        </Alert>
      ) : null}

      {(isSuccess || isError) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            uploadDebug("MeetingUploadDropzone onReset clicked", { phase: state.phase });
            onReset();
          }}
        >
          Upload another file
        </Button>
      )}
    </div>
  );
}
