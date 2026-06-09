const LOG_PREFIX = "[meetflow-capture]";

const $ = (id) => document.getElementById(id);

const authSection = $("auth-section");
const signedInEmailEl = $("signed-in-email");
const signInBtn = $("sign-in-btn");
const signOutBtn = $("sign-out-btn");
const captureSection = $("capture-section");
const recordingsSection = $("recordings-section");

const meetStatusEl = $("meet-status");
const micStatusEl = $("mic-status");
const captureStatusEl = $("capture-status");
const progressBar = $("progress-bar");
const recordingsList = $("recordings-list");

const startBtn = $("start-btn");
const stopBtn = $("stop-btn");
const resetStateBtn = $("reset-state-btn");

/** @type {{ tabId: number; meetUrl: string; meetCode: string | null; title: string | null; platform: string | null; platformLabel: string | null } | null} */
let activeMeeting = null;

const MIC_PERMISSION_TAB_TIMEOUT_MS = 180_000;

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

const MIC_STATUS_LABELS = {
  granted: "Microphone: allowed",
  denied:
    "Microphone: blocked — click Start Capture to retry or enable in chrome://settings/content/microphone",
  prompt: "Microphone: not granted — click Start Capture to allow",
  unknown: "Microphone: not granted — click Start Capture to allow",
  checking: "Microphone: checking…",
};

function setMicPermissionIndicator(state, detail) {
  micStatusEl.textContent = detail ?? MIC_STATUS_LABELS[state] ?? MIC_STATUS_LABELS.unknown;
  micStatusEl.className = `status mic-status mic-${state}`;
}

function applyMicFailureUi(error) {
  if (isMicNotAllowedError(error)) {
    setMicPermissionIndicator("denied");
    return;
  }
  const detail = formatMicStatusDetail(error);
  setMicPermissionIndicator("unknown", detail ?? MIC_STATUS_LABELS.unknown);
}

async function isMicrophoneGranted() {
  const stored = await extensionStorageGet(["micPermissionGranted"], "popup");
  if (stored.micPermissionGranted) {
    return true;
  }

  const state = await queryMicrophonePermissionState();
  if (state === "granted") {
    await extensionStorageSet({ micPermissionGranted: true, lastMicPermissionError: null }, "popup");
    return true;
  }
  return false;
}

function waitForMicPermissionResult() {
  return new Promise((resolve) => {
    const listener = (message) => {
      if (message?.type !== "MIC_PERMISSION_RESULT") {
        return;
      }
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timer);
      resolve(message);
    };

    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({
        ok: false,
        error: {
          name: "TimeoutError",
          message: "Microphone permission page did not respond. Close the tab and click Start Capture again.",
        },
      });
    }, MIC_PERMISSION_TAB_TIMEOUT_MS);

    chrome.runtime.onMessage.addListener(listener);
  });
}

async function ensureMicrophoneViaPermissionTab() {
  if (await isMicrophoneGranted()) {
    setMicPermissionIndicator("granted");
    return true;
  }

  setCaptureStatus("Opening microphone permission page…");
  setMicPermissionIndicator(
    "checking",
    "Microphone: click Allow microphone in the permission tab when it opens.",
  );

  const resultPromise = waitForMicPermissionResult();
  await chrome.tabs.create({ url: chrome.runtime.getURL("request-mic.html") });

  const result = await resultPromise;
  if (result?.ok) {
    setMicPermissionIndicator("granted");
    return true;
  }

  const error = result?.error ?? { name: "Error", message: "Microphone permission was not granted." };
  applyMicFailureUi(error);
  setCaptureStatus(formatMicCaptureStatus(error));
  return false;
}

async function refreshMicPermissionStatus() {
  setMicPermissionIndicator("checking");

  const stored = await extensionStorageGet(["micPermissionGranted", "lastMicPermissionError"], "popup");
  if (stored.micPermissionGranted || (await isMicrophoneGranted())) {
    setMicPermissionIndicator("granted");
    return "granted";
  }

  const state = await queryMicrophonePermissionState();
  if (state === "denied") {
    setMicPermissionIndicator("denied");
    return state;
  }

  if (stored.lastMicPermissionError) {
    applyMicFailureUi(stored.lastMicPermissionError);
    return "error";
  }

  setMicPermissionIndicator(state);
  return state;
}

async function getConfig() {
  const res = await sendMessage({ type: "GET_CONFIG" });
  return res?.config ?? {};
}

async function getSession() {
  const stored = await extensionStorageGet(["authSession"], "popup");
  return { session: stored.authSession ?? null };
}

async function saveSession(session) {
  await extensionStorageSet({ authSession: session }, "popup");
}

async function clearSession() {
  await extensionStorageRemove(["authSession"], "popup");
}

function showSections({ auth, capture, recordings }) {
  authSection.classList.toggle("hidden", !auth);
  captureSection.classList.toggle("hidden", !capture);
  recordingsSection.classList.toggle("hidden", !recordings);
}

function updateAuthControls(session) {
  const signedIn = Boolean(session?.accessToken);
  signInBtn.classList.toggle("hidden", signedIn);
  signOutBtn.classList.toggle("hidden", !signedIn);
  if (signedIn && session.email) {
    signedInEmailEl.textContent = `Signed in as ${session.email}`;
    signedInEmailEl.classList.remove("hidden");
  } else {
    signedInEmailEl.textContent = "";
    signedInEmailEl.classList.add("hidden");
  }
}

async function signInWithMeetFlow() {
  const config = await getConfig();
  const meetflowUrl = (config.meetflowUrl ?? "").replace(/\/$/, "");
  if (!meetflowUrl) {
    setCaptureStatus("MeetFlow URL is not configured.");
    return;
  }

  if (!chrome.identity?.launchWebAuthFlow) {
    setCaptureStatus("Chrome identity API is unavailable in this browser.");
    return;
  }

  setCaptureStatus("Opening MeetFlow sign in…");
  signInBtn.disabled = true;

  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `${meetflowUrl}/extension/auth?redirect_uri=${encodeURIComponent(redirectUri)}`;

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!url) {
          reject(new Error("MeetFlow sign in was cancelled."));
          return;
        }
        resolve(url);
      });
    });

    const code = new URL(responseUrl).searchParams.get("code");
    if (!code) {
      throw new Error("MeetFlow sign in did not return an authorization code.");
    }

    const res = await fetch(`${meetflowUrl}/api/extension/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "MeetFlow sign in failed.");
    }

    await saveSession({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      userId: body.userId ?? null,
      email: body.email ?? "",
      expiresAt: body.expiresAt ?? Date.now() + 3600 * 1000,
    });

    setCaptureStatus("Signed in with MeetFlow.");
    await initUi();
  } catch (error) {
    logError("signInWithMeetFlow failed", error);
    setCaptureStatus(error instanceof Error ? error.message : "MeetFlow sign in failed.");
  } finally {
    signInBtn.disabled = false;
  }
}

async function syncCaptureControls() {
  const state = await sendMessage({ type: "GET_CAPTURE_STATE" });
  const recorderActive = Boolean(state?.recorderActive);
  const onMeeting = Boolean(activeMeeting?.tabId);

  startBtn.disabled = recorderActive || !onMeeting;
  stopBtn.disabled = !recorderActive;

  if (recorderActive) {
    setCaptureStatus("Recording… You can close this popup.");
  } else if (state?.staleCleared) {
    setCaptureStatus("Previous recording session ended. Ready to capture.");
  }

  return state;
}

function resolveMeetingFromTab(tab, diag, source) {
  if (!tab?.id || !diag?.detectedPlatform) {
    return null;
  }
  const platform = getMeetingPlatformFromUrl(tab.url ?? "");
  return {
    tabId: tab.id,
    meetUrl: tab.url ?? null,
    meetCode: tab.url ? parseMeetingCode(tab.url) : null,
    title: tab.title ?? null,
    platform: diag.detectedPlatform,
    platformLabel: platform?.label ?? diag.detectedPlatform,
    source,
  };
}

async function refreshMeetingTabStatus() {
  const [popupActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const popupActiveDiag = diagnoseMeetingUrl(popupActiveTab?.url ?? "");

  const res = await sendMessage({ type: "GET_ACTIVE_MEETING_TAB" });
  if (!res?.ok) {
    meetStatusEl.innerHTML = '<span class="meet-bad">Could not read the active tab.</span>';
    startBtn.disabled = true;
    stopBtn.disabled = true;
    return;
  }

  let meetingInfo =
    resolveMeetingFromTab(
      { id: res.tabId, url: res.meetUrl, title: res.title },
      res.platform ? { detectedPlatform: res.platform } : null,
      "background",
    ) ?? null;

  if (!meetingInfo && popupActiveDiag.detectedPlatform) {
    meetingInfo = resolveMeetingFromTab(popupActiveTab, popupActiveDiag, "popup_activeTab");
    log("meeting detected via popup activeTab", { popupActiveDiag, backgroundRejected: res.diagnostics });
  }

  if (!meetingInfo && Array.isArray(res.diagnostics)) {
    const detected = res.diagnostics.find((entry) => entry.detectedPlatform && entry.tabId);
    if (detected) {
      meetingInfo = resolveMeetingFromTab(
        { id: detected.tabId, url: detected.url, title: detected.title },
        detected,
        "background_scan",
      );
    }
  }

  activeMeeting = meetingInfo;

  if (meetingInfo) {
    const label = meetingInfo.platformLabel ?? "Meeting";
    const code = meetingInfo.meetCode ? ` (${meetingInfo.meetCode})` : "";
    meetStatusEl.innerHTML = `<span class="meet-ok">Platform: ${label}${code}</span>`;
    await syncCaptureControls();
    return;
  }

  log("meeting tab not detected", {
    popupActiveTab: {
      url: popupActiveTab?.url ?? null,
      ...popupActiveDiag,
    },
    tabDiagnostics: res.diagnostics ?? [],
  });

  const rejectedSamples = (res.diagnostics ?? [])
    .filter((entry) => entry.rejectedReason)
    .slice(0, 3)
    .map((entry) => `${entry.hostname ?? "no-host"}: ${entry.rejectedReason}`);

  const rejectionHint =
    rejectedSamples.length > 0
      ? `<br><span class="meet-bad">Rejected: ${rejectedSamples.join("; ")}</span>`
      : popupActiveDiag.rejectedReason
        ? `<br><span class="meet-bad">Active tab: ${popupActiveDiag.rejectedReason}</span>`
        : "";

  meetStatusEl.innerHTML = `<span class="meet-bad">Open a meeting tab (${SUPPORTED_HOST_HINT}) and click this extension again.</span>${rejectionHint}`;
  startBtn.disabled = true;
  stopBtn.disabled = true;
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
      ? ` [tab=${item.diagnostics.tabAudioTrackCount ?? "?"}, mic=${item.diagnostics.micTrackCount ?? "?"}, mixed=${item.diagnostics.mixedAudioTrackCount ?? item.diagnostics.audioTrackCount ?? "?"}, bytes=${item.diagnostics.blobSize}, type=${item.diagnostics.blobType}]`
      : "";
    const link = item.viewUrl
      ? ` <a href="${item.viewUrl}" target="_blank" rel="noreferrer">Open</a>`
      : "";
    li.innerHTML = `${when} · ${item.fileName} · <strong>${status}</strong>${diag}${err}${link}`;
    recordingsList.appendChild(li);
  }
}

async function signOut() {
  await clearSession();
  setCaptureStatus("Signed out.");
  await initUi();
}

async function startCapture() {
  if (!activeMeeting?.tabId) {
    setCaptureStatus("No meeting tab active.");
    return;
  }

  const micGranted = await ensureMicrophoneViaPermissionTab();
  if (!micGranted) {
    await syncCaptureControls();
    return;
  }

  const { session } = await getSession();
  if (!session?.accessToken) {
    setCaptureStatus("Sign in before recording.");
    return;
  }

  setCaptureStatus("Starting offscreen capture…");
  setProgress(0);

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeMeeting.tabId });

  log("stream id acquired in popup", { tabId: activeMeeting.tabId, hasStreamId: Boolean(streamId) });

  const res = await sendMessage({
    type: "START_OFFSCREEN_RECORDING",
    streamId,
    tabId: activeMeeting.tabId,
    meetUrl: activeMeeting.meetUrl,
    meetCode: activeMeeting.meetCode,
    tabTitle: activeMeeting.title,
    platform: activeMeeting.platform,
    title: activeMeeting.title,
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
  await syncCaptureControls();
  await refreshRecordings();
}

async function resetExtensionState() {
  setCaptureStatus("Resetting extension state…");
  const res = await sendMessage({ type: "RESET_EXTENSION_STATE" });
  if (!res?.ok) {
    throw new Error(res?.error || "Could not reset extension state.");
  }
  setProgress(0);
  setCaptureStatus("Ready to capture.");
  await refreshMicPermissionStatus();
  await syncCaptureControls();
  await refreshRecordings();
}

async function initUi() {
  const { session } = await getSession();
  updateAuthControls(session);

  if (!session?.accessToken) {
    showSections({ auth: true, capture: false, recordings: true });
    setCaptureStatus("Sign in with MeetFlow to record and upload.");
    await refreshRecordings();
    return;
  }

  showSections({ auth: true, capture: true, recordings: true });
  if (!captureStatusEl.textContent) {
    setCaptureStatus(session.email ? `Signed in as ${session.email}` : "Signed in with MeetFlow.");
  }
  await Promise.all([refreshMeetingTabStatus(), refreshMicPermissionStatus(), refreshRecordings()]);
}

signInBtn.addEventListener("click", () => {
  void signInWithMeetFlow();
});

signOutBtn.addEventListener("click", () => {
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
