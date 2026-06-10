/** Shared finalize helpers for abrupt meeting termination recovery. */

const MIN_RECORDING_BYTES = 10_000;

const CAPTURE_STATUS = {
  MEETING_ENDED_UNEXPECTEDLY: "Meeting ended unexpectedly",
  SAVING_RECORDING: "Saving recording...",
  UPLOADING: "Uploading...",
  PARTIAL_CAPTURE_UPLOADED: "Partial Capture Uploaded",
  PARTIAL_CAPTURE_TOO_SHORT: "Partial Capture Too Short",
};

const FINALIZE_REASON = {
  MANUAL: "manual",
  ABRUPT: "abrupt",
};

function shouldAttemptFinalize(chunks) {
  return Array.isArray(chunks) && chunks.length > 0;
}

function isBlobTooSmall(blobSize) {
  return blobSize < MIN_RECORDING_BYTES;
}

function getTooSmallMessage(reason, blobSize) {
  if (reason === FINALIZE_REASON.ABRUPT) {
    return CAPTURE_STATUS.PARTIAL_CAPTURE_TOO_SHORT;
  }
  return `Recording too small (${blobSize} bytes). Stay in the meeting and record at least 10 seconds.`;
}

function buildFinalizeDiagnostics(mixDiagnostics, blob, chunkCount, reason) {
  return {
    ...(mixDiagnostics ?? {}),
    blobSize: blob.size,
    blobType: blob.type,
    chunkCount,
    capturedAt: new Date().toISOString(),
    finalizeReason: reason,
  };
}

function formatRecordingListStatus(uploadStatus) {
  if (uploadStatus === "partial") {
    return CAPTURE_STATUS.PARTIAL_CAPTURE_UPLOADED;
  }
  return uploadStatus ?? "unknown";
}

function attachTrackEndedHandlers(stream, onTrackEnded) {
  if (!stream) return;

  for (const track of stream.getTracks()) {
    track.addEventListener(
      "ended",
      () => onTrackEnded(track),
      { once: true },
    );
  }
}

function planFinalizeOutcome({ reason, chunkCount, blobSize }) {
  if (!shouldAttemptFinalize(Array.from({ length: chunkCount }))) {
    return { action: "none", ok: false };
  }

  if (isBlobTooSmall(blobSize)) {
    return {
      action:
        reason === FINALIZE_REASON.ABRUPT ? "partial_too_short" : "recording_failed",
      ok: false,
      message: getTooSmallMessage(reason, blobSize),
    };
  }

  return {
    action: reason === FINALIZE_REASON.ABRUPT ? "partial_upload" : "upload",
    ok: true,
  };
}

function abruptStatusProgression() {
  return [
    CAPTURE_STATUS.MEETING_ENDED_UNEXPECTEDLY,
    CAPTURE_STATUS.SAVING_RECORDING,
    CAPTURE_STATUS.UPLOADING,
    CAPTURE_STATUS.PARTIAL_CAPTURE_UPLOADED,
  ];
}

const MeetFlowRecordingFinalize = {
  MIN_RECORDING_BYTES,
  CAPTURE_STATUS,
  FINALIZE_REASON,
  shouldAttemptFinalize,
  isBlobTooSmall,
  getTooSmallMessage,
  buildFinalizeDiagnostics,
  formatRecordingListStatus,
  attachTrackEndedHandlers,
  planFinalizeOutcome,
  abruptStatusProgression,
};

if (typeof globalThis !== "undefined") {
  globalThis.MeetFlowRecordingFinalize = MeetFlowRecordingFinalize;
}
