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
const resetStateBtn = $("reset-state-btn");

/** @type {{ tabId: number; meetUrl: string; meetCode: string | null; title: string | null } | null} */
let activeMeet = null;

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

async function syncCaptureControls() {
  const state = await sendMessage({ type: "GET_CAPTURE_STATE" });
  const recorderActive = Boolean(state?.recorderActive);
  const onMeet = Boolean(activeMeet?.tabId);

  startBtn.disabled = recorderActive || !onMeet;
  stopBtn.disabled = !recorderActive;

  if (recorderActive) {
    setCaptureStatus("Recording… You can close this popup.");
  } else if (state?.staleCleared) {
    setCaptureStatus("Previous recording session ended. Ready to capture.");
  }

  return state;
}

async function refreshMeetTabStatus() {
  const res = await sendMessage({ type: "GET_ACTIVE_MEET_TAB" });
  if (!res?.ok) {
    meetStatusEl.innerHTML = '<span class="meet-bad">Could not read the active tab.</span>';
    startBtn.disabled = true;
    stopBtn.disabled = true;
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
    await syncCaptureControls();
  } else {
    meetStatusEl.innerHTML =
      '<span class="meet-bad">Open a meet.google.com tab and click this extension again.</span>';
    startBtn.disabled = true;
    stopBtn.disabled = true;
  }
}

async function refreshRecordings() {
  const res = await sendMessage({ type: "GET_RECORDINGS" });
  const recordings = res?.recordings ?? [];

  const state = await sendMessage({ type: "GET_CAPTURE_STATE" });
  if (state?.recorderActive) {
    setCaptureStatus("Recording… You can close this popup.");
  } else if (res?.lastCaptureStatus && !state?.staleCleared) {
    setCaptureStatus(res.lastCaptureStatus);
  }

  const diagRes = await sendMessage({ type: "GET_LAST_DIAGNOSTICS" });
  if (diagRes?.diagnostics) {
    const d = diagRes.diagnostics;
    log("last diagnostics", d);
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
    const diag = item.diagnostics
      ? ` [audio=${item.diagnostics.audioTrackCount}, bytes=${item.diagnostics.blobSize}, type=${item.diagnostics.blobType}]`
      : "";
    const link = item.viewUrl
      ? ` <a href="${item.viewUrl}" target="_blank" rel="noreferrer">Open</a>`
      : "";
    li.innerHTML = `${when} · ${item.fileName} · <strong>${status}</strong>${diag}${err}${link}`;
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

  setCaptureStatus("Starting offscreen capture…");
  setProgress(0);

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeMeet.tabId });
  log("stream id acquired in popup", { tabId: activeMeet.tabId, hasStreamId: Boolean(streamId) });

  const res = await sendMessage({
    type: "START_OFFSCREEN_RECORDING",
    streamId,
    tabId: activeMeet.tabId,
    meetUrl: activeMeet.meetUrl,
    meetCode: activeMeet.meetCode,
    title: activeMeet.title,
  });

  if (!res?.ok) {
    throw new Error(res?.error || "Could not start recording.");
  }

  await syncCaptureControls();
}

async function stopCapture() {
  stopBtn.disabled = true;
  setCaptureStatus("Stopping and uploading…");
  setProgress(50);

  const res = await sendMessage({ type: "STOP_OFFSCREEN_RECORDING" });
  if (!res?.ok) {
    throw new Error(res?.error || "Could not stop recording.");
  }

  setProgress(100);
  startBtn.disabled = false;
  stopBtn.disabled = true;
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
    void syncCaptureControls();
  });
});

stopBtn.addEventListener("click", () => {
  void stopCapture().catch((error) => {
    logError("stopCapture failed", error);
    setCaptureStatus(error instanceof Error ? error.message : "Could not stop capture.");
    void syncCaptureControls();
  });
});

resetStateBtn.addEventListener("click", () => {
  void resetExtensionState().catch((error) => {
    logError("resetExtensionState failed", error);
    setCaptureStatus(error instanceof Error ? error.message : "Could not reset extension state.");
    void syncCaptureControls();
  });
});

void initUi();
