import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_MEETING_FILE_BYTES,
} from "./constants";

export type FileValidationResult =
  | { valid: true }
  | { valid: false; message: string };

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

/** Strip MIME parameters (e.g. `audio/webm;codecs=opus` → `audio/webm`). */
export function baseMeetingMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedMeetingMimeType(mimeType: string): boolean {
  const base = baseMeetingMimeType(mimeType);
  if (!base) return true;
  return ALLOWED_MIME_TYPES.has(base);
}

/** Normalize for storage/API: base allowed type, else infer from filename. */
export function normalizeMeetingMimeType(mimeType: string, fileName?: string): string {
  const base = baseMeetingMimeType(mimeType);
  if (base && ALLOWED_MIME_TYPES.has(base)) {
    return base;
  }
  if (fileName?.trim()) {
    return mimeTypeFromFileName(fileName);
  }
  return base || "application/octet-stream";
}

export function validateMeetingFile(file: File): FileValidationResult {
  if (!file || file.size === 0) {
    return { valid: false, message: "File is empty." };
  }

  if (file.size > MAX_MEETING_FILE_BYTES) {
    return {
      valid: false,
      message: `File exceeds the ${Math.round(MAX_MEETING_FILE_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      message: `Unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  if (file.type && !isAllowedMeetingMimeType(file.type)) {
    return {
      valid: false,
      message: `Unsupported MIME type (${file.type}). Use mp3, mp4, wav, m4a, or webm.`,
    };
  }

  return { valid: true };
}

export function mimeTypeFromFileName(fileName: string): string {
  const ext = getExtension(fileName);
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".m4a": "audio/m4a",
    ".webm": "audio/webm",
  };
  return map[ext] ?? "application/octet-stream";
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return base.replace(/[-_]+/g, " ").trim() || "Untitled meeting";
}

export function sanitizeStorageFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_");
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMeetingDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fileExtensionLabel(fileName: string): string {
  const ext = getExtension(fileName).replace(".", "").toUpperCase();
  return ext || "FILE";
}
