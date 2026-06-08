export const MEETINGS_BUCKET = "meetings";

/** 500 MB */
export const MAX_MEETING_FILE_BYTES = 500 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".mp3", ".mp4", ".wav", ".m4a", ".webm"] as const;

export const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/webm",
  "video/webm",
]);

export const ACCEPT_UPLOAD =
  ".mp3,.mp4,.wav,.m4a,.webm,audio/mpeg,audio/mp3,video/mp4,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,video/webm";
