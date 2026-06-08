const MEET_HOST = "meet.google.com";
const LOG_PREFIX = "[meetflow-capture]";

const DEFAULT_CONFIG = {
  meetflowUrl: "https://meeting-flow.nisargjain.workers.dev",
  supabaseUrl: "",
  supabaseKey: "",
};

/** @type {{ recording: boolean; tabId: number | null; meetUrl: string | null; startedAt: string | null }} */
let captureState = {
  recording: false,
  tabId: null,
  meetUrl: null,
  startedAt: null,
};

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

async function uploadRecordingInBackground({ arrayBuffer, mimeType, fileName, meetUrl, meetTitle, bytes }) {
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void setBadgeForTab(tab);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await setBadgeForTab(tab);
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["captureState"]);
  if (stored.captureState) {
    captureState = stored.captureState;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_CAPTURE_STATE") {
    sendResponse({ ok: true, captureState });
    return;
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
        error: "Recording was empty. Keep the popup open while recording.",
        bytes: 0,
      };
      await saveRecordingRecord(failedRecord);
      await setLastCaptureStatus(failedRecord.error);
      sendResponse({ ok: true });
    })();
    return true;
  }
});
