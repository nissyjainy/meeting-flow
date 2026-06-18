const LOG_PREFIX = "[meetflow-capture:offscreen]";
const finalize = globalThis.MeetFlowRecordingFinalize;

/** @type {MediaRecorder | null} */
let mediaRecorder = null;
/** @type {MediaStream | null} */
let recordingStream = null;
/** @type {MediaStream | null} */
let fullStream = null;
/** @type {MediaStream | null} */
let micStream = null;
/** @type {AudioContext | null} */
let audioContext = null;
/** @type {MediaStreamAudioDestinationNode | null} */
let mixDestination = null;
/** @type {object | null} */
let mixDiagnostics = null;
/** @type {BlobPart[]} */
let recordedChunks = [];
/** @type {string} */
let recorderMimeType = "video/webm";
/** @type {object | null} */
let meetMeta = null;
/** @type {string} */
let recordingMode = "unknown";

/** @type {Promise<unknown> | null} */
let finalizeInFlight = null;
let manualStopInProgress = false;
let abruptTerminationHandled = false;
/** @type {ReturnType<typeof setInterval> | null} */
let sessionWatchInterval = null;
let tabCaptureMutedTicks = 0;

function log(step, detail) {
  console.info(`${LOG_PREFIX} ${step}`, detail ?? "");
}

function logError(step, error, detail) {
  console.error(`${LOG_PREFIX} ${step}`, error, detail ?? "");
}

function logStreamDiagnostics(label, stream) {
  log(`${label} tracks`, {
    audioTrackCount: stream.getAudioTracks().length,
    videoTrackCount: stream.getVideoTracks().length,
    audioTracks: stream.getAudioTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
    videoTracks: stream.getVideoTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
  });
}

async function getUserMediaFromStreamId(streamId) {
  const modernConstraints = {
    audio: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    video: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
  };
  const legacyConstraints = {
    audio: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    },
    video: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(modernConstraints);
  } catch (modernError) {
    log("modern getUserMedia failed, retrying legacy", modernError);
    return navigator.mediaDevices.getUserMedia(legacyConstraints);
  }
}

async function getMicrophoneStream() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

async function createMixedAudioStream(tabStream, microphoneStream) {
  audioContext = new AudioContext();
  mixDestination = audioContext.createMediaStreamDestination();

  const tabAudioStream = new MediaStream(tabStream.getAudioTracks());
  const tabSource = audioContext.createMediaStreamSource(tabAudioStream);
  const micSource = audioContext.createMediaStreamSource(microphoneStream);

  tabSource.connect(mixDestination);
  micSource.connect(mixDestination);
  tabSource.connect(audioContext.destination);

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return mixDestination.stream;
}

function stopSessionWatch() {
  if (sessionWatchInterval) {
    clearInterval(sessionWatchInterval);
    sessionWatchInterval = null;
  }
  tabCaptureMutedTicks = 0;
}

function startSessionWatch() {
  stopSessionWatch();
  sessionWatchInterval = setInterval(() => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      return;
    }
    if (manualStopInProgress || abruptTerminationHandled || finalizeInFlight) {
      return;
    }
    if (!fullStream) {
      return;
    }

    const tracks = fullStream.getTracks();
    if (tracks.some((track) => track.readyState === "ended")) {
      log("session watch: tab capture track ended");
      void handleAbruptTermination("session_watch_track_ended");
      return;
    }

    const liveTabAudio = fullStream.getAudioTracks().filter((track) => track.readyState === "live");
    if (liveTabAudio.length > 0 && liveTabAudio.every((track) => track.muted)) {
      tabCaptureMutedTicks += 1;
      if (tabCaptureMutedTicks >= 4) {
        log("session watch: tab capture audio muted");
        void handleAbruptTermination("session_watch_tab_audio_muted");
      }
    } else {
      tabCaptureMutedTicks = 0;
    }
  }, 2000);
}

function cleanup() {
  stopSessionWatch();
  if (recordingStream && recordingStream !== fullStream) {
    for (const track of recordingStream.getTracks()) track.stop();
  }
  recordingStream = null;
  if (fullStream) {
    for (const track of fullStream.getTracks()) track.stop();
    fullStream = null;
  }
  if (micStream) {
    for (const track of micStream.getTracks()) track.stop();
    micStream = null;
  }
  mixDestination = null;
  mixDiagnostics = null;
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
  mediaRecorder = null;
  recordedChunks = [];
  meetMeta = null;
  abruptTerminationHandled = false;
}

function buildFileName(meetCode) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = meetCode ? `${meetCode}-` : "";
  return `meet-capture-${suffix}${stamp}.webm`;
}

async function persistDiagnostics(diagnostics) {
  await chrome.runtime.sendMessage({
    type: "SAVE_LAST_DIAGNOSTICS",
    diagnostics,
  });
}

async function notifyCaptureStatus(status) {
  await chrome.runtime.sendMessage({
    type: "CAPTURE_STATUS_UPDATE",
    status,
  });
}

function attachCaptureTrackEndListeners() {
  finalize.attachTrackEndedHandlers(fullStream, (track) => {
    log("capture track ended", { kind: track.kind, id: track.id });
    void handleAbruptTermination("track_ended");
  });
}

async function prepareRecorderForFinalize() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    const onStop = () => {
      clearTimeout(timeout);
      resolve(undefined);
    };

    mediaRecorder.addEventListener("stop", onStop, { once: true });

    try {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.requestData();
        mediaRecorder.stop();
      } else {
        clearTimeout(timeout);
        resolve(undefined);
      }
    } catch (error) {
      logError("prepareRecorderForFinalize stop failed", error);
      clearTimeout(timeout);
      resolve(undefined);
    }
  });
}

async function handleAbruptTermination(source) {
  if (manualStopInProgress || abruptTerminationHandled || finalizeInFlight) {
    return;
  }

  abruptTerminationHandled = true;
  log("abrupt termination detected", { source });

  try {
    await prepareRecorderForFinalize();
    await finalizeFromChunks({ reason: finalize.FINALIZE_REASON.ABRUPT });
  } catch (error) {
    logError("handleAbruptTermination failed", error);
  }
}

async function uploadRecordingBlob({
  blob,
  fileName,
  meetUrl,
  meetTitle,
  diagnostics,
  partial = false,
}) {
  await validateWebmBlob(blob, diagnostics.blobSize);

  const sessionRes = await chrome.runtime.sendMessage({ type: "GET_UPLOAD_SESSION", force: true });
  if (!sessionRes?.ok) {
    throw new Error(sessionRes?.error || "Could not get upload session.");
  }

  const file = new File([blob], fileName, { type: blob.type || "video/webm" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", fileName);
  appendCaptureMetadata(formData, {
    meetUrl,
    tabTitle: meetMeta?.tabTitle ?? meetTitle,
    meetTitle,
    platform: meetMeta?.platform,
    meetCode: meetMeta?.meetCode,
  });

  log("upload POST from offscreen", {
    fileName,
    bytes: file.size,
    blobType: blob.type,
    uploadUrl: sessionRes.uploadUrl,
    partial,
  });

  const res = await fetch(sessionRes.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionRes.accessToken}`,
    },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = body.error || `Upload failed (HTTP ${res.status}).`;
    throw new Error(formatAuthErrorForUpload(raw));
  }

  const notifyRes = await chrome.runtime.sendMessage({
    type: "UPLOAD_SUCCEEDED",
    meetingId: body.meetingId,
    fileName: body.fileName ?? fileName,
    meetUrl: body.meetUrl ?? meetUrl ?? null,
    meetTitle: body.meetTitle ?? meetTitle ?? null,
    capturedAt: body.capturedAt ?? new Date().toISOString(),
    viewUrl: body.viewUrl ?? null,
    bytes: file.size,
    diagnostics,
    partial,
  });

  if (!notifyRes?.ok) {
    throw new Error(notifyRes?.error || "Upload succeeded but metadata save failed.");
  }

  return body;
}

async function finalizeFromChunks({ reason = finalize.FINALIZE_REASON.MANUAL } = {}) {
  if (finalizeInFlight) {
    return finalizeInFlight;
  }

  finalizeInFlight = (async () => {
    if (!finalize.shouldAttemptFinalize(recordedChunks)) {
      if (reason === finalize.FINALIZE_REASON.MANUAL) {
        throw new Error("No active recording.");
      }
      cleanup();
      return { ok: false, error: "no_chunks" };
    }

    if (reason === finalize.FINALIZE_REASON.ABRUPT) {
      await notifyCaptureStatus(finalize.CAPTURE_STATUS.MEETING_ENDED_UNEXPECTEDLY);
      await notifyCaptureStatus(finalize.CAPTURE_STATUS.SAVING_RECORDING);
    }

    const blob = new Blob(recordedChunks, { type: recorderMimeType });
    const diagnostics = finalize.buildFinalizeDiagnostics(
      mixDiagnostics,
      blob,
      recordedChunks.length,
      reason,
    );

    log("recording finalized", diagnostics);
    await persistDiagnostics(diagnostics);

    const fileName = buildFileName(meetMeta?.meetCode ?? null);
    const meetUrl = meetMeta?.meetUrl ?? null;
    const meetTitle = meetMeta?.tabTitle ?? null;

    cleanup();

    if (blob.size < finalize.MIN_RECORDING_BYTES) {
      const error = finalize.getTooSmallMessage(reason, blob.size);
      if (reason === finalize.FINALIZE_REASON.ABRUPT) {
        await chrome.runtime.sendMessage({
          type: "PARTIAL_CAPTURE_TOO_SHORT",
          fileName,
          error,
          diagnostics,
          meetUrl,
          meetTitle,
        });
      } else {
        await chrome.runtime.sendMessage({
          type: "RECORDING_FAILED",
          fileName,
          error,
          diagnostics,
          meetUrl,
          meetTitle,
        });
      }
      return { ok: false, error };
    }

    if (reason === finalize.FINALIZE_REASON.ABRUPT) {
      await notifyCaptureStatus(finalize.CAPTURE_STATUS.UPLOADING);
    }

    try {
      await uploadRecordingBlob({
        blob,
        fileName,
        meetUrl,
        meetTitle,
        diagnostics,
        partial: reason === finalize.FINALIZE_REASON.ABRUPT,
      });
      return { ok: true };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = formatAuthErrorForUpload(raw);
      let pendingSaved = false;
      try {
        await savePendingUpload({
          blob,
          fileName,
          mimeType: blob.type || recorderMimeType,
          bytes: blob.size,
          capturedAt: new Date().toISOString(),
          meetUrl,
          meetTitle,
          tabTitle: meetMeta?.tabTitle ?? meetTitle,
          platform: meetMeta?.platform ?? null,
          meetCode: meetMeta?.meetCode ?? null,
          diagnostics,
          error: message,
        });
        pendingSaved = true;
      } catch (saveError) {
        logError("save pending upload failed", saveError);
      }
      await chrome.runtime.sendMessage({
        type: "UPLOAD_FAILED",
        fileName,
        error: message,
        diagnostics,
        meetUrl,
        meetTitle,
        bytes: blob.size,
        pendingSaved,
      });
      throw error;
    }
  })();

  try {
    return await finalizeInFlight;
  } finally {
    finalizeInFlight = null;
  }
}

async function beginRecording(message) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    throw new Error("Recording already in progress.");
  }

  if (mediaRecorder && mediaRecorder.state !== "recording") {
    cleanup();
  }

  abruptTerminationHandled = false;
  manualStopInProgress = false;
  finalizeInFlight = null;

  meetMeta = {
    meetUrl: message.meetUrl ?? null,
    tabTitle: message.tabTitle ?? message.title ?? null,
    meetCode: message.meetCode ?? null,
    platform: message.platform ?? null,
    tabId: message.tabId ?? null,
  };

  fullStream = await getUserMediaFromStreamId(message.streamId);
  logStreamDiagnostics("full tab stream", fullStream);

  for (const track of fullStream.getAudioTracks()) {
    track.enabled = true;
  }

  attachCaptureTrackEndListeners();

  micStream = await getMicrophoneStream();
  logStreamDiagnostics("microphone stream", micStream);

  const mixedAudioStream = await createMixedAudioStream(fullStream, micStream);
  logStreamDiagnostics("mixed audio stream", mixedAudioStream);

  const mixedSetup = buildMixedRecordingStream(fullStream, mixedAudioStream);
  recordingStream = mixedSetup.recordingStream;
  const recorderSetup = selectRecorderMimeType(recordingStream);
  recordingStream = recorderSetup.stream ?? recordingStream;
  recorderMimeType = recorderSetup.mimeType;
  recordingMode = recorderSetup.mode;
  recordedChunks = [];

  mixDiagnostics = buildMixDiagnostics({
    tabStream: fullStream,
    micStream,
    mixedAudioStream,
    recordingStream,
    recordingMode,
  });
  log("mix diagnostics", mixDiagnostics);
  logStreamDiagnostics("recording stream", recordingStream);

  mediaRecorder = new MediaRecorder(recordingStream, {
    mimeType: recorderMimeType,
    audioBitsPerSecond: 128000,
    videoBitsPerSecond: recordingMode === "video+audio" ? 250000 : undefined,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data?.size > 0) {
      recordedChunks.push(event.data);
      log("chunk", { size: event.data.size, chunks: recordedChunks.length });
    }
  };

  mediaRecorder.onstop = () => {
    log("mediaRecorder stopped", { manual: manualStopInProgress });
    if (!manualStopInProgress && !finalizeInFlight) {
      void handleAbruptTermination("recorder_stop");
    }
  };

  mediaRecorder.onerror = (event) => {
    logError("MediaRecorder error", event.error || event);
    if (!manualStopInProgress) {
      void handleAbruptTermination("recorder_error");
    }
  };

  mediaRecorder.start(1000);
  startSessionWatch();
  log("recording started", {
    mimeType: recorderMimeType,
    mode: recordingMode,
    ...mixDiagnostics,
  });
}

async function endRecording() {
  const recorderActive = Boolean(mediaRecorder && mediaRecorder.state === "recording");

  if (recorderActive) {
    manualStopInProgress = true;
    abruptTerminationHandled = true;
    try {
      await prepareRecorderForFinalize();
    } finally {
      manualStopInProgress = false;
    }
  } else if (!finalize.shouldAttemptFinalize(recordedChunks)) {
    throw new Error("No active recording.");
  }

  return finalizeFromChunks({ reason: finalize.FINALIZE_REASON.MANUAL });
}

async function finalizeIfNeeded() {
  if (!finalize.shouldAttemptFinalize(recordedChunks)) {
    return { ok: false, finalized: false };
  }

  await prepareRecorderForFinalize();
  const result = await finalizeFromChunks({ reason: finalize.FINALIZE_REASON.ABRUPT });
  return { ok: Boolean(result?.ok), finalized: true, error: result?.error };
}

function getRecorderStatus() {
  const active = Boolean(mediaRecorder && mediaRecorder.state === "recording");
  return {
    ok: true,
    active,
    recorderState: mediaRecorder?.state ?? "none",
    hasChunks: finalize.shouldAttemptFinalize(recordedChunks),
  };
}

function forceReset() {
  cleanup();
  finalizeInFlight = null;
  manualStopInProgress = false;
  return { ok: true, active: false, recorderState: "none" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_RECORDER_STATUS") {
    sendResponse(getRecorderStatus());
    return;
  }

  if (message?.type === "FORCE_RESET") {
    sendResponse(forceReset());
    return;
  }

  if (message?.type === "BEGIN_RECORDING") {
    void beginRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        logError("beginRecording failed", error);
        cleanup();
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "END_RECORDING") {
    void endRecording()
      .then((result) => sendResponse({ ok: Boolean(result?.ok), error: result?.error }))
      .catch((error) => {
        logError("endRecording failed", error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "FINALIZE_IF_NEEDED") {
    void finalizeIfNeeded()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => {
        logError("finalizeIfNeeded failed", error);
        sendResponse({ ok: false, finalized: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "TRIGGER_ABRUPT_TERMINATION") {
    void handleAbruptTermination(message.source ?? "external")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        logError("TRIGGER_ABRUPT_TERMINATION failed", error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }
});
