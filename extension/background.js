const MEET_HOST = "meet.google.com";
const LOG_PREFIX = "[meetflow-capture]";

const DEFAULT_CONFIG = {
  meetflowUrl: "https://meeting-flow.nisargjain.workers.dev",
  supabaseUrl: "",
  supabaseKey: "",
};

const IDLE_CAPTURE_STATE = {
  recording: false,
  tabId: null,
  meetUrl: null,
  startedAt: null,
};

/** @type {{ recording: boolean; tabId: number | null; meetUrl: string | null; startedAt: string | null }} */
let captureState = { ...IDLE_CAPTURE_STATE };

function log(step, detail) {
  console.info(`${LOG_PREFIX} ${step}`, detail ?? "");
}

function logError(step, error, detail) {
  console.error(`${LOG_PREFIX} ${step}`, error, detail ?? "");
}

function isMeetUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === MEET_HOST || parsed.hostname.endsWith(`.${MEET_HOST}`);
  } catch {
    return false;
  }
}

function parseMeetCode(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/([a-z]{3,}-[a-z]{3,}-[a-z]{3,})/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function getConfig() {
  const stored = await chrome.storage.local.get(["extensionConfig"]);
  return { ...DEFAULT_CONFIG, ...(stored.extensionConfig ?? {}) };
}

async function getSession() {
  const stored = await chrome.storage.local.get(["authSession", "extensionConfig"]);
  return {
    session: stored.authSession ?? null,
    config: { ...DEFAULT_CONFIG, ...(stored.extensionConfig ?? {}) },
  };
}

async function saveRecordingRecord(record) {
  const stored = await chrome.storage.local.get(["captureRecordings"]);
  const recordings = Array.isArray(stored.captureRecordings) ? stored.captureRecordings : [];
  recordings.unshift(record);
  await chrome.storage.local.set({ captureRecordings: recordings.slice(0, 20) });
}

async function setLastCaptureStatus(status) {
  await chrome.storage.local.set({ lastCaptureStatus: status });
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
    throw new Error(body.error_description || "Session expired. Sign in again.");
  }

  const next = {
    ...session,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  await chrome.storage.local.set({ authSession: next });
  return next;
}

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("offscreen.html")],
  });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Record Google Meet tab audio while the popup is closed.",
  });
  log("offscreen document created");
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage(message);
}

async function uploadRecordingInBackground({ arrayBuffer, mimeType, fileName, meetUrl, meetTitle, bytes, diagnostics }) {
  log("background upload started", { fileName, bytes });

  const { config, session: initialSession } = await getSession();
  if (!initialSession?.accessToken) {
    throw new Error("Sign in before uploading.");
  }

  const session = await refreshAuthToken(config, initialSession);
  const blob = new Blob([arrayBuffer], { type: mimeType || "audio/webm" });
  const file = new File([blob], fileName, { type: mimeType || "audio/webm" });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", fileName);
  if (meetUrl) formData.append("meetUrl", meetUrl);
  if (meetTitle) formData.append("meetTitle", meetTitle);

  const uploadUrl = `${config.meetflowUrl.replace(/\/$/, "")}/api/extension/meeting-upload`;
  log("background upload POST", { uploadUrl, fileName, bytes: file.size });

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Upload failed (HTTP ${res.status}).`);
  }

  const record = {
    id: crypto.randomUUID(),
    meetingId: body.meetingId,
    fileName: body.fileName ?? fileName,
    meetUrl: body.meetUrl ?? meetUrl ?? null,
    meetTitle: body.meetTitle ?? meetTitle ?? null,
    capturedAt: body.capturedAt ?? new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    uploadStatus: "success",
    viewUrl: body.viewUrl ?? null,
    bytes: bytes ?? file.size,
    diagnostics: diagnostics ?? null,
  };

  await saveRecordingRecord(record);
  await setLastCaptureStatus(`Upload complete. Meeting ${body.meetingId}`);
  log("background upload success", { meetingId: body.meetingId });
  return record;
}

async function setBadgeForTab(tab) {
  if (!tab?.id) return;
  if (tab.url && isMeetUrl(tab.url)) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "MEET" });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#1a73e8" });
  } else {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  }
}

async function syncCaptureState(next) {
  captureState = { ...captureState, ...next };
  await chrome.storage.local.set({ captureState });
}

async function clearCaptureState(statusMessage) {
  captureState = { ...IDLE_CAPTURE_STATE };
  await chrome.storage.local.set({ captureState });
  if (statusMessage) {
    await setLastCaptureStatus(statusMessage);
  }
}

async function getOffscreenRecorderStatus() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("offscreen.html")],
  });
  if (contexts.length === 0) {
    return { active: false, recorderState: "none", offscreenPresent: false };
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_RECORDER_STATUS" });
    return {
      active: Boolean(response?.active),
      recorderState: response?.recorderState ?? "unknown",
      offscreenPresent: true,
    };
  } catch (error) {
    logError("getOffscreenRecorderStatus failed", error);
    return { active: false, recorderState: "unreachable", offscreenPresent: true };
  }
}

async function reconcileCaptureState({ forceClear = false } = {}) {
  if (forceClear) {
    try {
      await sendToOffscreen({ type: "FORCE_RESET" });
    } catch {
      // Offscreen may not exist after reload.
    }
    await clearCaptureState("Extension state reset.");
    return { captureState, recorderActive: false, staleCleared: true };
  }

  const stored = await chrome.storage.local.get(["captureState"]);
  if (stored.captureState) {
    captureState = { ...captureState, ...stored.captureState };
  }

  const thinksRecording = Boolean(captureState.recording);
  const recorderStatus = await getOffscreenRecorderStatus();
  const recorderActive = recorderStatus.active;

  if (thinksRecording && !recorderActive) {
    log("clearing stale recording state", { captureState, recorderStatus });
    await clearCaptureState("Previous recording session ended. Ready to capture.");
    return { captureState, recorderActive: false, staleCleared: true };
  }

  if (recorderActive && !thinksRecording) {
    await syncCaptureState({ recording: true });
  }

  return { captureState, recorderActive: recorderActive, staleCleared: thinksRecording && !recorderActive };
}

async function initializeExtensionState() {
  const stored = await chrome.storage.local.get(["captureState"]);
  if (stored.captureState) {
    captureState = { ...IDLE_CAPTURE_STATE, ...stored.captureState };
  }
  await reconcileCaptureState();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void setBadgeForTab(tab);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await setBadgeForTab(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionState();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtensionState();
});

void initializeExtensionState();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_CAPTURE_STATE") {
    void (async () => {
      const result = await reconcileCaptureState();
      sendResponse({
        ok: true,
        captureState: result.captureState,
        recorderActive: result.recorderActive,
        staleCleared: result.staleCleared,
      });
    })();
    return true;
  }

  if (message?.type === "RESET_EXTENSION_STATE") {
    void (async () => {
      try {
        const result = await reconcileCaptureState({ forceClear: true });
        sendResponse({ ok: true, ...result });
      } catch (error) {
        logError("RESET_EXTENSION_STATE failed", error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "GET_ACTIVE_MEET_TAB") {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const onMeet = Boolean(tab?.url && isMeetUrl(tab.url));
      sendResponse({
        ok: true,
        onMeet,
        tabId: tab?.id ?? null,
        meetUrl: tab?.url ?? null,
        meetCode: tab?.url ? parseMeetCode(tab.url) : null,
        title: tab?.title ?? null,
      });
    })();
    return true;
  }

  if (message?.type === "START_OFFSCREEN_RECORDING") {
    void (async () => {
      try {
        const current = await reconcileCaptureState();
        if (current.recorderActive) {
          sendResponse({ ok: false, error: "Recording already in progress." });
          return;
        }

        const result = await sendToOffscreen({
          type: "BEGIN_RECORDING",
          streamId: message.streamId,
          tabId: message.tabId,
          meetUrl: message.meetUrl,
          meetCode: message.meetCode,
          title: message.title,
        });

        if (!result?.ok) {
          await clearCaptureState(result?.error || "Could not start recording.");
          sendResponse(result);
          return;
        }

        await syncCaptureState({
          recording: true,
          tabId: message.tabId ?? null,
          meetUrl: message.meetUrl ?? null,
          startedAt: new Date().toISOString(),
        });
        await setLastCaptureStatus("Recording… You can close this popup.");
        sendResponse(result);
      } catch (error) {
        logError("START_OFFSCREEN_RECORDING failed", error);
        await clearCaptureState(error instanceof Error ? error.message : "Could not start recording.");
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "STOP_OFFSCREEN_RECORDING") {
    void (async () => {
      try {
        const current = await reconcileCaptureState();
        if (!current.recorderActive) {
          await clearCaptureState("No active recording.");
          sendResponse({ ok: false, error: "No active recording." });
          return;
        }

        await setLastCaptureStatus("Stopping recording…");
        const result = await sendToOffscreen({ type: "END_RECORDING" });
        await clearCaptureState(result?.ok ? "Processing upload…" : result?.error || "Could not stop recording.");
        sendResponse(result);
      } catch (error) {
        logError("STOP_OFFSCREEN_RECORDING failed", error);
        await clearCaptureState(error instanceof Error ? error.message : "Could not stop recording.");
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "RECORDING_FAILED") {
    void (async () => {
      await clearCaptureState(message.error);
      const failedRecord = {
        id: crypto.randomUUID(),
        fileName: message.fileName ?? "meet-capture.webm",
        meetUrl: message.meetUrl ?? null,
        meetTitle: message.meetTitle ?? null,
        capturedAt: new Date().toISOString(),
        uploadStatus: "failed",
        error: message.error,
        bytes: message.diagnostics?.blobSize ?? 0,
        diagnostics: message.diagnostics ?? null,
      };
      await saveRecordingRecord(failedRecord);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "GET_LAST_DIAGNOSTICS") {
    void (async () => {
      const stored = await chrome.storage.local.get(["lastRecordingDiagnostics"]);
      sendResponse({ ok: true, diagnostics: stored.lastRecordingDiagnostics ?? null });
    })();
    return true;
  }

  if (message?.type === "CAPTURE_STARTED") {
    void (async () => {
      await syncCaptureState({
        recording: true,
        tabId: message.tabId ?? null,
        meetUrl: message.meetUrl ?? null,
        startedAt: message.startedAt ?? new Date().toISOString(),
      });
      await chrome.storage.local.set({
        pendingCaptureContext: {
          tabId: message.tabId ?? null,
          meetUrl: message.meetUrl ?? null,
          meetCode: message.meetCode ?? null,
          title: message.title ?? null,
        },
      });
      await setLastCaptureStatus("Recording…");
      log("capture started", message);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "CAPTURE_STOPPED") {
    void (async () => {
      await syncCaptureState({
        recording: false,
        tabId: null,
        meetUrl: null,
        startedAt: null,
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "UPLOAD_RECORDING") {
    void (async () => {
      try {
        const record = await uploadRecordingInBackground(message);
        if (message.diagnostics) {
          await chrome.storage.local.set({ lastRecordingDiagnostics: message.diagnostics });
        }
        sendResponse({ ok: true, record });
      } catch (error) {
        logError("background upload failed", error);
        const failedRecord = {
          id: crypto.randomUUID(),
          fileName: message.fileName,
          meetUrl: message.meetUrl ?? null,
          meetTitle: message.meetTitle ?? null,
          capturedAt: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          uploadStatus: "failed",
          error: error instanceof Error ? error.message : String(error),
          bytes: message.bytes ?? 0,
          diagnostics: message.diagnostics ?? null,
        };
        await saveRecordingRecord(failedRecord);
        await setLastCaptureStatus(failedRecord.error);
        sendResponse({ ok: false, error: failedRecord.error, record: failedRecord });
      }
    })();
    return true;
  }

  if (message?.type === "SAVE_RECORDING_METADATA") {
    void (async () => {
      await saveRecordingRecord(message.record);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "GET_RECORDINGS") {
    void (async () => {
      const stored = await chrome.storage.local.get(["captureRecordings", "lastCaptureStatus"]);
      sendResponse({
        ok: true,
        recordings: stored.captureRecordings ?? [],
        lastCaptureStatus: stored.lastCaptureStatus ?? null,
      });
    })();
    return true;
  }

  if (message?.type === "GET_CONFIG") {
    void (async () => {
      const config = await getConfig();
      sendResponse({ ok: true, config });
    })();
    return true;
  }

  if (message?.type === "RECORDING_EMPTY") {
    void (async () => {
      const failedRecord = {
        id: crypto.randomUUID(),
        fileName: message.fileName ?? "meet-capture.webm",
        capturedAt: new Date().toISOString(),
        uploadStatus: "failed",
        error: "Recording was empty. Record at least 10 seconds in the Meet call.",
        bytes: 0,
      };
      await saveRecordingRecord(failedRecord);
      await setLastCaptureStatus(failedRecord.error);
      sendResponse({ ok: true });
    })();
    return true;
  }
});
