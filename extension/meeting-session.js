/** Detect when a captured meeting tab has left the active call session. */

const GOOGLE_MEET_ENDED_TITLE_PATTERNS = [
  /^Google Meet$/i,
  /you left the meeting/i,
  /meeting has ended/i,
  /meeting ended/i,
  /return to home/i,
  /call ended/i,
];

function isGoogleMeetEndedTitle(title) {
  const trimmed = (title ?? "").trim();
  if (!trimmed) {
    return false;
  }
  return GOOGLE_MEET_ENDED_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function meetingCodeAppearsInTitle(meetCode, title) {
  if (!meetCode || !title) {
    return false;
  }
  const normalizedTitle = title.toLowerCase();
  const code = meetCode.toLowerCase();
  if (normalizedTitle.includes(code)) {
    return true;
  }
  return normalizedTitle.includes(code.replace(/-/g, ""));
}

/**
 * Returns true when the capture tab is no longer in the meeting that was active at record start.
 * @param {chrome.tabs.Tab | null | undefined} tab
 * @param {{ recording?: boolean; meetUrl?: string | null; meetCode?: string | null; tabTitle?: string | null }} captureState
 */
function isCaptureTabSessionEnded(tab, captureState) {
  if (!captureState?.recording) {
    return false;
  }

  if (!tab) {
    return true;
  }

  const url = tab.url ?? "";
  const platform = getMeetingPlatformFromUrl(url);
  if (!platform) {
    return true;
  }

  const startCode = captureState.meetCode ?? parseMeetingCode(captureState.meetUrl ?? "");
  const currentCode = parseMeetingCode(url);

  if (startCode) {
    if (!currentCode || currentCode !== startCode) {
      return true;
    }
  }

  if (platform.id === "google_meet") {
    const title = tab.title ?? "";
    if (isGoogleMeetEndedTitle(title)) {
      return true;
    }

    const startTitle = captureState.tabTitle ?? "";
    if (startTitle && startCode && title !== startTitle) {
      const hadCodeInStart = meetingCodeAppearsInTitle(startCode, startTitle);
      const hasCodeNow = meetingCodeAppearsInTitle(startCode, title);
      if (hadCodeInStart && !hasCodeNow && title.length > 0) {
        return true;
      }
    }
  }

  if (platform.id === "zoom") {
    if (/\/postattendee|\/leave/i.test(url)) {
      return true;
    }
  }

  return false;
}
