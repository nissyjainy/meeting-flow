/** Shared microphone permission helpers for popup and request-mic tab. */

const MIC_AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

function isMicNotAllowedError(error) {
  if (!error) return false;
  if (error.name === "NotAllowedError") return true;
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function serializeMicError(error) {
  if (!error) return { name: "Error", message: "Unknown error" };
  return {
    name: error.name || "Error",
    message: error.message || String(error),
  };
}

function formatMicStatusDetail(error) {
  const serialized = serializeMicError(error);
  if (isMicNotAllowedError(serialized)) {
    return null;
  }
  return `Microphone error: ${serialized.name}: ${serialized.message}`;
}

function formatMicCaptureStatus(error) {
  const serialized = serializeMicError(error);
  if (isMicNotAllowedError(serialized)) {
    return "Microphone access is required to record your voice. Click Start Capture to retry.";
  }
  return `${serialized.name}: ${serialized.message}`;
}

async function queryMicrophonePermissionState() {
  try {
    if (!navigator.permissions?.query) {
      return "unknown";
    }
    const result = await navigator.permissions.query({ name: "microphone" });
    return result.state;
  } catch {
    return "unknown";
  }
}
