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
/** @type {BlobPart[]} */
let recordedChunks = [];
/** @type {{ tabId: number; meetUrl: string; meetCode: string | null; title: string | null } | null} */
let activeMeet = null;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
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
    startBtn.disabled = Boolean(mediaRecorder);
  } else {
    meetStatusEl.innerHTML =
      '<span class="meet-bad">Open a meet.google.com tab and click this extension again.</span>';
    startBtn.disabled = true;
  }
}

async function refreshRecordings() {
  const res = await sendMessage({ type: "GET_RECORDINGS" });
  const recordings = res?.recordings ?? [];
  recordingsList.innerHTML = "";

  if (!recordings.length) {
    recordingsList.innerHTML = "<li>No captures yet.</li>";
    return;
  }

  for (const item of recordings) {
    const li = document.createElement("li");
    const when = new Date(item.capturedAt).toLocaleString();
    const status = item.uploadStatus ?? "unknown";
    const link = item.viewUrl
      ? `<a href="${item.viewUrl}" target="_blank" rel="noreferrer">Open</a>`
      : "";
    li.innerHTML = `${when} · ${item.fileName} · <strong>${status}</strong> ${link}`;
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
  await initUi();
}

async function signOut() {
  await clearSession();
  setCaptureStatus("Signed out.");
  await initUi();
}

async function refreshAuthToken(config, session) {
  if (!session?.refreshToken) return session;
  if (session.expiresAt && session.expiresAt > Date.now() + 60_000) return session;

  const res = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    await clearSession();
    throw new Error(body.error_description || "Session expired. Sign in again.");
  }

  const next = {
    ...session,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  await saveSession(next);
  return next;
}

function buildFileName(meetCode) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = meetCode ? `${meetCode}-` : "";
  return `meet-capture-${suffix}${stamp}.webm`;
}

function pickRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

async function startCapture() {
  if (!activeMeet?.tabId) {
    setCaptureStatus("No Google Meet tab active.");
    return;
  }

  setCaptureStatus("Requesting tab audio…");
  setProgress(0);

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeMeet.tabId });

  captureStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  recordedChunks = [];
  const mimeType = pickRecorderMimeType();
  mediaRecorder = new MediaRecorder(captureStream, { mimeType, audioBitsPerSecond: 128000 });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data?.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.onerror = () => {
    setCaptureStatus("Recording error. Try again.");
    void stopCapture({ upload: false });
  };

  mediaRecorder.onstop = () => {
    void handleRecordingStopped();
  };

  mediaRecorder.start(1000);
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setCaptureStatus("Recording… Keep this popup open.");
  await sendMessage({
    type: "CAPTURE_STARTED",
    tabId: activeMeet.tabId,
    meetUrl: activeMeet.meetUrl,
    startedAt: new Date().toISOString(),
  });
}

async function stopCapture({ upload }) {
  stopBtn.disabled = true;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (captureStream) {
    for (const track of captureStream.getTracks()) track.stop();
    captureStream = null;
  }

  if (!upload) {
    mediaRecorder = null;
    recordedChunks = [];
    startBtn.disabled = false;
    await sendMessage({ type: "CAPTURE_STOPPED" });
  }
}

async function handleRecordingStopped() {
  const blob = new Blob(recordedChunks, {
    type: mediaRecorder?.mimeType || "audio/webm",
  });
  mediaRecorder = null;
  recordedChunks = [];

  await sendMessage({ type: "CAPTURE_STOPPED" });
  startBtn.disabled = false;

  if (!blob.size) {
    setCaptureStatus("Recording was empty.");
    return;
  }

  try {
    await uploadRecording(blob);
  } catch (error) {
    setCaptureStatus(error instanceof Error ? error.message : "Upload failed.");
    setProgress(0);
  }
}

function uploadWithProgress({ url, token, formData, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        body = { error: xhr.responseText || "Invalid server response." };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject(new Error(body.error || `Upload failed (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
  });
}

async function uploadRecording(blob) {
  const { config, session: initialSession } = await getSession();
  if (!initialSession?.accessToken) {
    throw new Error("Sign in before uploading.");
  }

  const session = await refreshAuthToken(config, initialSession);
  const fileName = buildFileName(activeMeet?.meetCode ?? null);
  const file = new File([blob], fileName, { type: blob.type || "audio/webm" });

  const formData = new FormData();
  formData.append("file", file);
  if (activeMeet?.meetUrl) formData.append("meetUrl", activeMeet.meetUrl);
  if (activeMeet?.title) formData.append("meetTitle", activeMeet.title);

  const uploadUrl = `${config.meetflowUrl.replace(/\/$/, "")}/api/extension/meeting-upload`;

  setCaptureStatus(`Uploading ${fileName}…`);
  setProgress(0);

  const result = await uploadWithProgress({
    url: uploadUrl,
    token: session.accessToken,
    formData,
    onProgress: (percent) => {
      setProgress(percent);
      setCaptureStatus(`Uploading… ${percent}%`);
    },
  });

  const record = {
    id: crypto.randomUUID(),
    meetingId: result.meetingId,
    fileName: result.fileName ?? fileName,
    meetUrl: result.meetUrl ?? activeMeet?.meetUrl ?? null,
    meetTitle: result.meetTitle ?? activeMeet?.title ?? null,
    capturedAt: result.capturedAt ?? new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    uploadStatus: "success",
    viewUrl: result.viewUrl ?? null,
    bytes: blob.size,
  };

  await sendMessage({ type: "SAVE_RECORDING_METADATA", record });
  setProgress(100);
  setCaptureStatus(`Upload complete. Meeting ${result.meetingId}`);
  await refreshRecordings();
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
    await refreshRecordings();
    return;
  }

  showSections({ setup: false, auth: true, capture: true, recordings: true });
  $("email").value = session.email ?? "";
  setCaptureStatus(session.email ? `Signed in as ${session.email}` : "Signed in.");
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
    setCaptureStatus(error instanceof Error ? error.message : "Could not start capture.");
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
});

stopBtn.addEventListener("click", () => {
  void stopCapture({ upload: true });
});

void initUi();
