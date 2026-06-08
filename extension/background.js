const MEET_HOST = "meet.google.com";

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
    void syncCaptureState({
      recording: true,
      tabId: message.tabId ?? null,
      meetUrl: message.meetUrl ?? null,
      startedAt: message.startedAt ?? new Date().toISOString(),
    });
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "CAPTURE_STOPPED") {
    void syncCaptureState({
      recording: false,
      tabId: null,
      meetUrl: null,
      startedAt: null,
    });
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "SAVE_RECORDING_METADATA") {
    void (async () => {
      const stored = await chrome.storage.local.get(["captureRecordings"]);
      const recordings = Array.isArray(stored.captureRecordings) ? stored.captureRecordings : [];
      recordings.unshift(message.record);
      await chrome.storage.local.set({ captureRecordings: recordings.slice(0, 20) });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "GET_RECORDINGS") {
    void (async () => {
      const stored = await chrome.storage.local.get(["captureRecordings"]);
      sendResponse({ ok: true, recordings: stored.captureRecordings ?? [] });
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
});
