const LOG_PREFIX = "[meetflow-capture]";

const $ = (id) => document.getElementById(id);

const setupSection = $("setup-section");
const authSection = $("auth-section");
const captureSection = $("capture-section");
const recordingsSection = $("recordings-section");

const meetStatusEl = $("meet-status");
const captureStatusEl = $("capture-status");
const progressBar = $("progress-bar");
const recordingsList = $("recordings-list");

const startBtn = $("start-btn");
const stopBtn = $("stop-btn");

/** @type {MediaRecorder | null} */
let mediaRecorder = null;
/** @type {MediaStream | null} */
let captureStream = null;
/** @type {MediaStream | null} */
let captureFullStream = null;
/** @type {AudioContext | null} */
let captureAudioContext = null;
/** @type {BlobPart[]} */
let recordedChunks = [];
/** @type {{ tabId: number; meetUrl: string; meetCode: string | null; title: string | null } | null} */
let activeMeet = null;
/** @type {string} */
let recorderMimeType = "audio/webm";
let shouldUploadOnStop = true;
let isFinalizing = false;

function log(step, detail) {
  console.info(`${LOG_PREFIX} ${step}`, detail ?? "");
}

function logError(step, error, detail) {
  console.error(`${LOG_PREFIX} ${step}`, error, detail ?? "");
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function setProgress(percent) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function setCaptureStatus(text) {
  captureStatusEl.textContent = text;
}

async function getConfig() {
  const res = await sendMessage({ type: "GET_CONFIG" });
  return res?.config ?? {};
}

async function getSession() {
  const stored = await chrome.storage.local.get(["authSession", "extensionConfig"]);
  return {
    session: stored.authSession ?? null,
    config: stored.extensionConfig ?? {},
  };
}

async function saveConfig(config) {
  await chrome.storage.local.set({ extensionConfig: config });
}

async function saveSession(session) {
  await chrome.storage.local.set({ authSession: session });
}

async function clearSession() {
  await chrome.storage.local.remove(["authSession"]);
}

function needsSetup(config) {
  return !config.meetflowUrl?.trim() || !config.supabaseUrl?.trim() || !config.supabaseKey?.trim();
}

function showSections({ setup, auth, capture, recordings }) {
  setupSection.classList.toggle("hidden", !setup);
  authSection.classList.toggle("hidden", !auth);
  captureSection.classList.toggle("hidden", !capture);
  recordingsSection.classList.toggle("hidden", !recordings);
}

async function refreshMeetTabStatus() {
  const res = await sendMessage({ type: "GET_ACTIVE_MEET_TAB" });
  if (!res?.ok) {
    meetStatusEl.innerHTML = '<span class="meet-bad">Could not read the active tab.</span>';
    startBtn.disabled = true;
    return;
  }

  activeMeet = res.onMeet
    ? {
        tabId: res.tabId,
        meetUrl: res.meetUrl,
        meetCode: res.meetCode,
        title: res.title,
      }
    : null;

  if (res.onMeet) {
    const code = res.meetCode ? ` (${res.meetCode})` : "";
    meetStatusEl.innerHTML = `<span class="meet-ok">Google Meet tab detected${code}</span>`;
    startBtn.disabled = Boolean(mediaRecorder && mediaRecorder.state === "recording");
  } else {
    meetStatusEl.innerHTML =
      '<span class="meet-bad">Open a meet.google.com tab and click this extension again.</span>';
    startBtn.disabled = true;
  }
}

async function refreshRecordings() {
  const res = await sendMessage({ type: "GET_RECORDINGS" });
  const recordings = res?.recordings ?? [];

  if (res?.lastCaptureStatus) {
    setCaptureStatus(res.lastCaptureStatus);
  }

  recordingsList.innerHTML = "";

  if (!recordings.length) {
    recordingsList.innerHTML = "<li>No captures yet.</li>";
    return;
  }

  for (const item of recordings) {
    const li = document.createElement("li");
    const when = new Date(item.capturedAt).toLocaleString();
    const status = item.uploadStatus ?? "unknown";
    const err = item.error ? ` — ${item.error}` : "";
    const link = item.viewUrl
      ? ` <a href="${item.viewUrl}" target="_blank" rel="noreferrer">Open</a>`
      : "";
    li.innerHTML = `${when} · ${item.fileName} · <strong>${status}</strong>${err}${link}`;
    recordingsList.appendChild(li);
  }
}

async function signIn() {
  const { config } = await getSession();
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    setCaptureStatus("Enter email and password.");
    return;
  }

  setCaptureStatus("Signing in…");
  const res = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setCaptureStatus(body.error_description || body.msg || body.message || "Sign in failed.");
    return;
  }

  await saveSession({
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user?.id ?? null,
    email,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });

  $("password").value = "";
  setCaptureStatus("Signed in.");
  log("signed in", { email });
  await initUi();
}

async function signOut() {
  await clearSession();
  setCaptureStatus("Signed out.");
  await initUi();
}

function buildFileName(meetCode) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = meetCode ? `${meetCode}-` : "";
  return `meet-capture-${suffix}${stamp}.webm`;
}

function logStreamDiagnostics(label, stream) {
  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();
  log(`${label} tracks`, {
    audioTrackCount: audioTracks.length,
    videoTrackCount: videoTracks.length,
    audioTracks: audioTracks.map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
    videoTracks: videoTracks.map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    })),
  });
}

function pickRecorderMimeType(stream) {
  const hasVideo = stream.getVideoTracks().length > 0;
  const candidates = hasVideo
    ? ["video/webm;codecs=vp8,opus", "video/webm", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return hasVideo ? "video/webm" : "audio/webm";
}

async function getUserMediaFromStreamId(streamId) {
  const modernConstraints = {
    audio: {
      chromeMediaSource: "tab",
      chromeMediaSourceId: streamId,
    },
    video: {
      chromeMediaSource: "tab",
      chromeMediaSourceId: streamId,
    },
  };

  const legacyConstraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(modernConstraints);
  } catch (modernError) {
    log("getUserMedia modern constraints failed, retrying legacy", modernError);
    return navigator.mediaDevices.getUserMedia(legacyConstraints);
  }
}

function captureTabViaLegacyApi() {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: true }, (stream) => {
      if (chrome.runtime.lastError || !stream) {
        reject(new Error(chrome.runtime.lastError?.message || "tabCapture.capture() returned no stream."));
        return;
      }
      resolve(stream);
    });
  });
}

async function openTabCaptureStream(tabId) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  log("tabCapture stream id", { tabId, streamId: Boolean(streamId) });

  let fullStream;
  try {
    fullStream = await getUserMediaFromStreamId(streamId);
    logStreamDiagnostics("getMediaStreamId stream", fullStream);
  } catch (streamIdError) {
    log("getMediaStreamId path failed, trying tabCapture.capture()", streamIdError);
    fullStream = await captureTabViaLegacyApi();
    logStreamDiagnostics("tabCapture.capture stream", fullStream);
  }

  await routeTabAudioToOutput(fullStream);
  return fullStream;
}

async function routeTabAudioToOutput(stream) {
  captureAudioContext = new AudioContext();
  const source = captureAudioContext.createMediaStreamSource(stream);
  source.connect(captureAudioContext.destination);
  if (captureAudioContext.state === "suspended") {
    await captureAudioContext.resume();
  }
  log("AudioContext routing enabled", { state: captureAudioContext.state });
}

function buildRecordingSetup(fullStream) {
  const audioTracks = fullStream.getAudioTracks();
  const videoTracks = fullStream.getVideoTracks();

  if (audioTracks.length === 0) {
    throw new Error(
      "No audio track in tab capture. Join the Meet call, unmute speakers, and try again.",
    );
  }

  for (const track of audioTracks) {
    track.enabled = true;
  }

  // Tab capture is most reliable when muxing the full stream into video/webm.
  if (videoTracks.length > 0) {
    const videoMimeCandidates = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm",
    ];
    for (const mimeType of videoMimeCandidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return { stream: fullStream, mimeType, mode: "video+audio" };
      }
    }
  }

  const audioOnlyStream = new MediaStream(audioTracks);
  return {
    stream: audioOnlyStream,
    mimeType: pickRecorderMimeType(audioOnlyStream),
    mode: "audio-only",
  };
}

function cleanupStream() {
  if (captureStream) {
    for (const track of captureStream.getTracks()) track.stop();
    captureStream = null;
  }
  if (captureFullStream) {
    for (const track of captureFullStream.getTracks()) track.stop();
    captureFullStream = null;
  }
  if (captureAudioContext) {
    void captureAudioContext.close();
    captureAudioContext = null;
  }
}

async function startCapture() {
  if (!activeMeet?.tabId) {
    setCaptureStatus("No Google Meet tab active.");
    return;
  }

  const { session } = await getSession();
  if (!session?.accessToken) {
    setCaptureStatus("Sign in before recording.");
    return;
  }

  setCaptureStatus("Requesting tab audio…");
  setProgress(0);
  log("start capture", activeMeet);

  captureFullStream = await openTabCaptureStream(activeMeet.tabId);
  const recordingSetup = buildRecordingSetup(captureFullStream);
  captureStream = recordingSetup.stream;
  recorderMimeType = recordingSetup.mimeType;
  logStreamDiagnostics("recording stream", captureStream);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(captureStream, {
    mimeType: recorderMimeType,
    audioBitsPerSecond: 128000,
    videoBitsPerSecond: recordingSetup.mode === "video+audio" ? 250000 : undefined,
  });

  log("MediaRecorder created", {
    mimeType: recorderMimeType,
    mode: recordingSetup.mode,
    state: mediaRecorder.state,
    audioTrackCount: captureStream.getAudioTracks().length,
    videoTrackCount: captureStream.getVideoTracks().length,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data?.size > 0) {
      recordedChunks.push(event.data);
      log("chunk", { size: event.data.size, chunks: recordedChunks.length });
    }
  };

  shouldUploadOnStop = true;

  mediaRecorder.onerror = (event) => {
    logError("MediaRecorder error", event.error || event);
    setCaptureStatus("Recording error. Try again.");
    shouldUploadOnStop = false;
    if (mediaRecorder?.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (stopError) {
        logError("stop after recorder error failed", stopError);
      }
    }
  };

  mediaRecorder.onstop = () => {
    log("MediaRecorder stopped", { chunks: recordedChunks.length });
    void finalizeCapture({ upload: shouldUploadOnStop });
    shouldUploadOnStop = true;
  };

  mediaRecorder.start(1000);
  log("MediaRecorder started", { state: mediaRecorder.state });

  startBtn.disabled = true;
  stopBtn.disabled = false;
  setCaptureStatus("Recording… Keep this popup open.");
  await sendMessage({
    type: "CAPTURE_STARTED",
    tabId: activeMeet.tabId,
    meetUrl: activeMeet.meetUrl,
    meetCode: activeMeet.meetCode,
    title: activeMeet.title,
    startedAt: new Date().toISOString(),
  });
}

async function stopCapture() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    setCaptureStatus("No active recording.");
    return;
  }

  stopBtn.disabled = true;
  setCaptureStatus("Stopping recording…");
  log("stop requested", { state: mediaRecorder.state, chunks: recordedChunks.length });

  try {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.requestData();
    }
    mediaRecorder.stop();
  } catch (error) {
    logError("mediaRecorder.stop failed", error);
    setCaptureStatus("Could not stop recording.");
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

async function finalizeCapture({ upload }) {
  if (isFinalizing) return;
  isFinalizing = true;

  const mimeType = mediaRecorder?.mimeType || recorderMimeType || "audio/webm";
  const recorder = mediaRecorder;
  mediaRecorder = null;

  const blob = new Blob(recordedChunks, { type: mimeType });
  const chunkCount = recordedChunks.length;
  recordedChunks = [];

  cleanupStream();
  await sendMessage({ type: "CAPTURE_STOPPED" });

  startBtn.disabled = false;
  stopBtn.disabled = true;

  log("finalize capture", {
    upload,
    blobSize: blob.size,
    blobType: blob.type,
    chunkCount,
    recorderState: recorder?.state,
    recorderMimeType: mimeType,
  });

  if (!upload) {
    setCaptureStatus("Recording cancelled.");
    isFinalizing = false;
    return;
  }

  const fileName = buildFileName(activeMeet?.meetCode ?? null);

  if (!blob.size) {
    const message = "Recording was empty. Keep the popup open while recording.";
    setCaptureStatus(message);
    await sendMessage({ type: "RECORDING_EMPTY", fileName });
    await refreshRecordings();
    isFinalizing = false;
    return;
  }

  try {
    setCaptureStatus(`Uploading ${fileName} (${Math.round(blob.size / 1024)} KB)…`);
    setProgress(10);

    const arrayBuffer = await blob.arrayBuffer();
    const res = await sendMessage({
      type: "UPLOAD_RECORDING",
      arrayBuffer,
      mimeType,
      fileName,
      meetUrl: activeMeet?.meetUrl ?? null,
      meetTitle: activeMeet?.title ?? null,
      bytes: blob.size,
    });

    if (!res?.ok) {
      throw new Error(res?.error || "Upload failed.");
    }

    setProgress(100);
    setCaptureStatus(`Upload complete. Meeting ${res.record?.meetingId ?? ""}`.trim());
    log("upload complete", res.record);
    await refreshRecordings();
  } catch (error) {
    logError("upload failed", error);
    setCaptureStatus(error instanceof Error ? error.message : "Upload failed.");
    setProgress(0);
    await refreshRecordings();
  } finally {
    isFinalizing = false;
  }
}

async function initUi() {
  const config = await getConfig();
  const { session } = await getSession();

  $("meetflow-url").value = config.meetflowUrl ?? "";
  $("supabase-url").value = config.supabaseUrl ?? "";
  $("supabase-key").value = config.supabaseKey ?? "";

  if (needsSetup(config)) {
    showSections({ setup: true, auth: false, capture: false, recordings: false });
    return;
  }

  if (!session?.accessToken) {
    showSections({ setup: false, auth: true, capture: false, recordings: true });
    setCaptureStatus("Sign in to record and upload.");
    await refreshRecordings();
    return;
  }

  showSections({ setup: false, auth: true, capture: true, recordings: true });
  $("email").value = session.email ?? "";
  if (!captureStatusEl.textContent) {
    setCaptureStatus(session.email ? `Signed in as ${session.email}` : "Signed in.");
  }
  await Promise.all([refreshMeetTabStatus(), refreshRecordings()]);
}

$("save-config-btn").addEventListener("click", async () => {
  const config = {
    meetflowUrl: $("meetflow-url").value.trim(),
    supabaseUrl: $("supabase-url").value.trim(),
    supabaseKey: $("supabase-key").value.trim(),
  };
  await saveConfig(config);
  setCaptureStatus("Settings saved.");
  log("config saved", { meetflowUrl: config.meetflowUrl });
  await initUi();
});

$("sign-in-btn").addEventListener("click", () => {
  void signIn();
});

$("sign-out-btn").addEventListener("click", () => {
  void signOut();
});

startBtn.addEventListener("click", () => {
  void startCapture().catch((error) => {
    logError("startCapture failed", error);
    setCaptureStatus(error instanceof Error ? error.message : "Could not start capture.");
    cleanupStream();
    captureFullStream = null;
    mediaRecorder = null;
    recordedChunks = [];
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
});

stopBtn.addEventListener("click", () => {
  void stopCapture();
});

void initUi();
