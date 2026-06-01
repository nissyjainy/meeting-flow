export type MeetingPlatform = "Zoom" | "Google Meet" | "Microsoft Teams" | "Unknown";

const MEETING_URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export function detectMeetingPlatform(url: string): MeetingPlatform {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return "Unknown";

  if (
    normalized.includes("meet.google.com") ||
    normalized.includes("hangouts.google.com") ||
    /google\.com\/meet/.test(normalized)
  ) {
    return "Google Meet";
  }

  if (
    normalized.includes("zoom.us/") ||
    normalized.includes("zoom.com/") ||
    /\.zoom\.us\//.test(normalized)
  ) {
    return "Zoom";
  }

  if (normalized.includes("teams.microsoft.com") || normalized.includes("teams.live.com")) {
    return "Microsoft Teams";
  }

  return "Unknown";
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?)]+$/, "");
}

export function findMeetingUrlInText(text: string): string | null {
  const matches = text.match(MEETING_URL_PATTERN);
  if (!matches?.length) return null;

  for (const match of matches) {
    const cleaned = stripTrailingPunctuation(match);
    if (detectMeetingPlatform(cleaned) !== "Unknown") {
      return cleaned;
    }
  }

  return stripTrailingPunctuation(matches[0] ?? "") || null;
}

export function meetingPlatformLabel(platform: MeetingPlatform | null | undefined): string {
  if (!platform || platform === "Unknown") return "Meeting";
  return platform;
}
