/** User-facing auth error messages for extension capture/upload. */

const SESSION_EXPIRED_UPLOAD_MESSAGE =
  "Your MeetFlow session expired. Please sign in again to upload your recording.";

const SIGN_IN_AGAIN_MESSAGE = "Please sign in again.";

function isAuthSessionError(message) {
  if (!message) return false;
  const lower = String(message).toLowerCase();
  return (
    lower.includes("invalid refresh token") ||
    lower.includes("refresh token not found") ||
    lower.includes("missing refresh token") ||
    lower.includes("session expired. sign in again")
  );
}

function formatAuthErrorForUpload(message) {
  if (!message) return message;
  return isAuthSessionError(message) ? SESSION_EXPIRED_UPLOAD_MESSAGE : String(message);
}

function formatAuthErrorForCapture(message) {
  if (!message) return message;
  return isAuthSessionError(message) ? SIGN_IN_AGAIN_MESSAGE : String(message);
}
