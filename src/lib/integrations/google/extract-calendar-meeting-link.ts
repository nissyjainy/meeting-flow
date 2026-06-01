import {
  detectMeetingPlatform,
  findMeetingUrlInText,
  type MeetingPlatform,
} from "@/lib/meetings/detect-meeting-platform";

export type GoogleCalendarMeetingSource = {
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

export type ExtractedCalendarMeetingLink = {
  meetingUrl: string | null;
  platform: MeetingPlatform | null;
};

const PLATFORM_PRIORITY: Record<MeetingPlatform, number> = {
  "Google Meet": 1,
  Zoom: 2,
  "Microsoft Teams": 3,
  Unknown: 4,
};

function addCandidate(candidates: string[], value: string | undefined | null): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  candidates.push(trimmed);
}

function collectCandidates(event: GoogleCalendarMeetingSource): string[] {
  const candidates: string[] = [];

  for (const entry of event.conferenceData?.entryPoints ?? []) {
    if (entry.entryPointType === "video" && entry.uri?.trim()) {
      addCandidate(candidates, entry.uri);
    }
  }

  addCandidate(candidates, event.hangoutLink);

  if (event.location?.trim()) {
    const location = event.location.trim();
    const fromLocation = findMeetingUrlInText(location);
    addCandidate(candidates, fromLocation ?? (location.startsWith("http") ? location : null));
  }

  if (event.description?.trim()) {
    addCandidate(candidates, findMeetingUrlInText(event.description));
  }

  return candidates;
}

export function extractCalendarMeetingLink(
  event: GoogleCalendarMeetingSource,
): ExtractedCalendarMeetingLink {
  const candidates = collectCandidates(event);
  const seen = new Set<string>();
  let best: { url: string; platform: MeetingPlatform; priority: number } | null = null;

  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);

    const platform = detectMeetingPlatform(url);
    const priority = PLATFORM_PRIORITY[platform];
    if (!best || priority < best.priority) {
      best = { url, platform, priority };
    }
  }

  if (!best) {
    return { meetingUrl: null, platform: null };
  }

  return { meetingUrl: best.url, platform: best.platform };
}
