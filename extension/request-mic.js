const LOG_PREFIX = "[meetflow-capture:request-mic]";

const statusText = document.getElementById("status-text");
const errorText = document.getElementById("error-text");
const successText = document.getElementById("success-text");
const allowBtn = document.getElementById("allow-btn");

function log(step, detail) {
  console.info(`${LOG_PREFIX} ${step}`, detail ?? "");
}

function logError(step, error, detail) {
  console.error(`${LOG_PREFIX} ${step}`, error, detail ?? "");
}

function showError(error) {
  const serialized = serializeMicError(error);
  errorText.textContent = `${serialized.name}: ${serialized.message}`;
  errorText.classList.remove("hidden");
  successText.classList.add("hidden");
}

function showSuccess(message) {
  successText.textContent = message;
  successText.classList.remove("hidden");
  errorText.classList.add("hidden");
}

async function notifyPermissionResult(result) {
  try {
    await chrome.runtime.sendMessage({
      type: "MIC_PERMISSION_RESULT",
      ...result,
    });
  } catch (error) {
    logError("MIC_PERMISSION_RESULT send failed", error);
  }
}

async function requestMicrophoneAccess() {
  allowBtn.disabled = true;
  statusText.textContent = "Requesting microphone access…";
  errorText.classList.add("hidden");

  try {
    const stream = await navigator.mediaDevices.getUserMedia(MIC_AUDIO_CONSTRAINTS);
    for (const track of stream.getTracks()) {
      track.stop();
    }

    await extensionStorageSet(
      {
        micPermissionGranted: true,
        lastMicPermissionError: null,
      },
      "request-mic",
    );

    showSuccess("Microphone allowed. This tab will close automatically.");
    log("getUserMedia success");

    await notifyPermissionResult({ ok: true });

    const tab = await chrome.tabs.getCurrent();
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    const serialized = serializeMicError(error);
    logError("getUserMedia failed", error, serialized);

    await extensionStorageSet({ lastMicPermissionError: serialized }, "request-mic");
    await notifyPermissionResult({ ok: false, error: serialized });

    showError(serialized);
    statusText.textContent = "Microphone access failed. Click Allow microphone to retry.";
    allowBtn.disabled = false;
  }
}

allowBtn.addEventListener("click", () => {
  void requestMicrophoneAccess();
});
