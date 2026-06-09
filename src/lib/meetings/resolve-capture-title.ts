import type { MeetingPlatform } from "./detect-meeting-platform";
import { detectMeetingPlatform } from "./detect-meeting-platform";
import { extractGoogleMeetCode } from "./extract-google-meet-code";

const GENERIC_TITLE_SET = new Set([
  "zoom meeting",
  "google meet",
  "microsoft teams",
  "microsoft teams meeting",
  "meet",
  "zoom",
  "teams",
  "calendar",
  "meeting",
  "untitled meeting",
  "zoom webinar",
  "teams meeting",
]);

const PLATFORM_TITLE_SUFFIX_PATTERNS = [
  / - google meet$/i,
  / \| google meet$/i,
  / \| microsoft teams$/i,
  / - microsoft teams$/i,
  / \| zoom$/i,
  / - zoom$/i,
  / \| zoom meeting$/i,
];

const MEET_CODE_ONLY_TITLE = /^meet - [a-z]{3,}-[a-z]{3,}-[a-z]{3,}$/i;

export type CaptureTitleInput = {
  calendarTitle?: string | null;
  tabTitle?: string | null;
  meetTitle?: string | null;
  meetingCode?: string | null;
  meetUrl?: string | null;
  platform?: MeetingPlatform | null;
};

export function normalizeMeetingUrlForMatch(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "";
    const host = parsed.hostname.toLowerCase();
    const search = parsed.search ?? "";
    return `${host}${path}${search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function meetingUrlsLikelyMatch(left: string | null, right: string | null): boolean {
  const a = normalizeMeetingUrlForMatch(left);
  const b = normalizeMeetingUrlForMatch(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

export function isGenericMeetingTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (GENERIC_TITLE_SET.has(normalized)) return true;
  if (MEET_CODE_ONLY_TITLE.test(trimmed)) return true;
  if (/^calendar \| microsoft teams$/i.test(trimmed)) return true;
  return false;
}

export function extractPlatformMeetingTitle(
  tabTitle: string | null | undefined,
  platform?: MeetingPlatform | null,
): string | null {
  let title = tabTitle?.trim() ?? "";
  if (!title) return null;

  for (const pattern of PLATFORM_TITLE_SUFFIX_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  if (platform === "Microsoft Teams" && /^calendar$/i.test(title)) {
    return null;
  }

  if (isGenericMeetingTitle(title)) {
    return null;
  }

  return title;
}

export function extensionPlatformIdToMeetingPlatform(
  platformId: string | null | undefined,
): MeetingPlatform | null {
  const normalized = platformId?.trim().toLowerCase() ?? "";
  if (normalized === "google_meet" || normalized === "google meet") return "Google Meet";
  if (normalized === "zoom") return "Zoom";
  if (normalized === "teams" || normalized === "microsoft teams") return "Microsoft Teams";
  if (normalized === "unknown") return "Unknown";
  return null;
}

export function resolveMeetingPlatform(
  meetUrl: string | null | undefined,
  platformHint: string | null | undefined,
): MeetingPlatform | null {
  const fromHint = extensionPlatformIdToMeetingPlatform(platformHint);
  if (fromHint) return fromHint;

  const detected = detectMeetingPlatform(meetUrl ?? "");
  return detected === "Unknown" ? null : detected;
}

export function resolveCaptureMeetingCode(
  meetingCode: string | null | undefined,
  meetUrl: string | null | undefined,
): string | null {
  const explicit = meetingCode?.trim();
  if (explicit) return explicit;
  return extractGoogleMeetCode(meetUrl) ?? null;
}

/**
 * Title priority: calendar event → platform UI title → tab title → code → Untitled Meeting
 */
export function resolveCaptureTitle(input: CaptureTitleInput): string {
  const calendarTitle = input.calendarTitle?.trim();
  if (calendarTitle) return calendarTitle;

  const tabTitle = input.tabTitle?.trim() || input.meetTitle?.trim() || "";
  const platformTitle = extractPlatformMeetingTitle(tabTitle, input.platform);
  if (platformTitle) return platformTitle;

  if (tabTitle && !isGenericMeetingTitle(tabTitle)) {
    return tabTitle;
  }

  const code =
    resolveCaptureMeetingCode(input.meetingCode, input.meetUrl) ??
    input.meetingCode?.trim() ??
    null;
  if (code) return code;

  return "Untitled Meeting";
}
