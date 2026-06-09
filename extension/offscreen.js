const LOG_PREFIX = "[meetflow-capture:offscreen]";
const MIN_RECORDING_BYTES = 10_000;

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

function cleanup() {
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

async function uploadRecordingBlob({ blob, fileName, meetUrl, meetTitle, diagnostics }) {
  await validateWebmBlob(blob, diagnostics.blobSize);

  const sessionRes = await chrome.runtime.sendMessage({ type: "GET_UPLOAD_SESSION" });
  if (!sessionRes?.ok) {
    throw new Error(sessionRes?.error || "Could not get upload session.");
  }

  const file = new File([blob], fileName, { type: blob.type || "video/webm" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", fileName);
  if (meetUrl) formData.append("meetUrl", meetUrl);
  if (meetTitle) formData.append("meetTitle", meetTitle);

  log("upload POST from offscreen", {
    fileName,
    bytes: file.size,
    blobType: blob.type,
    uploadUrl: sessionRes.uploadUrl,
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
    throw new Error(body.error || `Upload failed (HTTP ${res.status}).`);
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
  });

  if (!notifyRes?.ok) {
    throw new Error(notifyRes?.error || "Upload succeeded but metadata save failed.");
  }

  return body;
}

async function beginRecording(message) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    throw new Error("Recording already in progress.");
  }

  meetMeta = {
    meetUrl: message.meetUrl ?? null,
    meetTitle: message.title ?? null,
    meetCode: message.meetCode ?? null,
    tabId: message.tabId ?? null,
  };

  fullStream = await getUserMediaFromStreamId(message.streamId);
  logStreamDiagnostics("full tab stream", fullStream);

  for (const track of fullStream.getAudioTracks()) {
    track.enabled = true;
  }

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

  mediaRecorder.onerror = (event) => {
    logError("MediaRecorder error", event.error || event);
  };

  mediaRecorder.start(1000);
  log("recording started", {
    mimeType: recorderMimeType,
    mode: recordingMode,
    ...mixDiagnostics,
  });
}

async function endRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    throw new Error("No active recording.");
  }

  await new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => resolve();
    mediaRecorder.onerror = (event) => reject(event.error || new Error("Recorder stop failed"));
    try {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.requestData();
      }
      mediaRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });

  const blob = new Blob(recordedChunks, { type: recorderMimeType });
  const diagnostics = {
    ...(mixDiagnostics ?? {}),
    blobSize: blob.size,
    blobType: blob.type,
    chunkCount: recordedChunks.length,
    capturedAt: new Date().toISOString(),
  };

  log("recording finalized", diagnostics);
  await persistDiagnostics(diagnostics);

  const fileName = buildFileName(meetMeta?.meetCode ?? null);
  const meetUrl = meetMeta?.meetUrl ?? null;
  const meetTitle = meetMeta?.meetTitle ?? null;
  cleanup();

  if (blob.size < MIN_RECORDING_BYTES) {
    const error = `Recording too small (${blob.size} bytes). Stay in the meeting and record at least 10 seconds.`;
    await chrome.runtime.sendMessage({
      type: "RECORDING_FAILED",
      fileName,
      error,
      diagnostics,
      meetUrl,
      meetTitle,
    });
    return;
  }

  try {
    await uploadRecordingBlob({ blob, fileName, meetUrl, meetTitle, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await chrome.runtime.sendMessage({
      type: "UPLOAD_FAILED",
      fileName,
      error: message,
      diagnostics,
      meetUrl,
      meetTitle,
      bytes: blob.size,
    });
    throw error;
  }
}

function getRecorderStatus() {
  const active = Boolean(mediaRecorder && mediaRecorder.state === "recording");
  return {
    ok: true,
    active,
    recorderState: mediaRecorder?.state ?? "none",
  };
}

function forceReset() {
  cleanup();
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
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        logError("endRecording failed", error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }
});
