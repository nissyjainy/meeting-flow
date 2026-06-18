export const SESSION_EXPIRED_UPLOAD_MESSAGE =
  "Your MeetFlow session expired. Please sign in again to upload your recording.";

export const SIGN_IN_AGAIN_MESSAGE = "Please sign in again.";

export function isAuthSessionError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = String(message).toLowerCase();
  return (
    lower.includes("invalid refresh token") ||
    lower.includes("refresh token not found") ||
    lower.includes("missing refresh token") ||
    lower.includes("session expired. sign in again")
  );
}

export function formatAuthErrorForUpload(message: string): string {
  if (!message) return message;
  return isAuthSessionError(message) ? SESSION_EXPIRED_UPLOAD_MESSAGE : String(message);
}

export function formatAuthErrorForCapture(message: string): string {
  if (!message) return message;
  return isAuthSessionError(message) ? SIGN_IN_AGAIN_MESSAGE : String(message);
}
