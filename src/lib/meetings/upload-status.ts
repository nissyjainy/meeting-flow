import type { MeetingUploadState, UploadPhase } from "./types";

export function isUploadProcessingPhase(phase: UploadPhase): boolean {
  return (
    phase === "validating" ||
    phase === "uploading" ||
    phase === "saving" ||
    phase === "transcribing"
  );
}

export function getUploadPhaseLabel(state: MeetingUploadState): string | null {
  switch (state.phase) {
    case "validating":
      return "Checking file…";
    case "uploading":
      return `Uploading… ${state.progress}%`;
    case "saving":
      return "Saving meeting…";
    case "transcribing":
      return "Running AI processing (transcription, summary, action items)…";
    case "complete":
      return "Upload complete";
    case "error":
      return null;
    default:
      return null;
  }
}

export function getUploadHeadline(state: MeetingUploadState, isDragging: boolean): string {
  if (isDragging) return "Drop your recording here";

  switch (state.phase) {
    case "validating":
      return "Checking your file…";
    case "uploading":
      return "Uploading your recording…";
    case "saving":
      return "Saving meeting details…";
    case "transcribing":
      return "Upload successful — AI is processing your recording…";
    case "complete":
      return state.aiOutcome === "complete" ? "AI processing completed" : "Upload finished";
    case "error":
      return "Something went wrong";
    default:
      return "Drag & drop a meeting recording";
  }
}

export function getUploadProgressValue(state: MeetingUploadState): number | null {
  if (!isUploadProcessingPhase(state.phase)) return null;
  if (state.phase === "uploading") return state.progress;
  if (state.phase === "validating") return 8;
  if (state.phase === "saving") return 88;
  if (state.phase === "transcribing") return 96;
  return null;
}
