/** Shared meeting platform detection for MeetFlow extension (background + popup). */

const MEETING_PLATFORMS = {
  google_meet: {
    id: "google_meet",
    label: "Google Meet",
    badgeText: "MEET",
    badgeColor: "#1a73e8",
  },
  zoom: {
    id: "zoom",
    label: "Zoom",
    badgeText: "ZOOM",
    badgeColor: "#2d8cff",
  },
  teams: {
    id: "teams",
    label: "Microsoft Teams",
    badgeText: "TEAM",
    badgeColor: "#6264a7",
  },
};

/** Host suffixes — hostname must equal suffix or end with `.suffix`. Order: longest first. */
const MEETING_HOST_SUFFIXES = [
  { suffix: "teams.cloud.microsoft", platformId: "teams" },
  { suffix: "teams.microsoft.com", platformId: "teams" },
  { suffix: "teams.live.com", platformId: "teams" },
  { suffix: "meet.google.com", platformId: "google_meet" },
  { suffix: "app.zoom.us", platformId: "zoom" },
  { suffix: "zoom.us", platformId: "zoom" },
  { suffix: "zoom.com", platformId: "zoom" },
];

const SUPPORTED_HOST_HINT =
  "meet.google.com, app.zoom.us, zoom.us, zoom.com, teams.microsoft.com, teams.live.com, or teams.cloud.microsoft";

function hostnameMatchesSuffix(hostname, suffix) {
  const normalized = hostname.toLowerCase();
  const allowed = suffix.toLowerCase();
  return normalized === allowed || normalized.endsWith(`.${allowed}`);
}

function getMeetingPlatformFromUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    for (const { suffix, platformId } of MEETING_HOST_SUFFIXES) {
      if (hostnameMatchesSuffix(hostname, suffix)) {
        return MEETING_PLATFORMS[platformId] ?? null;
      }
    }
  } catch {
    // Invalid URL.
  }
  return null;
}

function isMeetingUrl(url) {
  return getMeetingPlatformFromUrl(url) !== null;
}

/**
 * Diagnostic for a single URL — explains accept/reject for Zoom/Teams debugging.
 * @returns {{ url: string | null, hostname: string | null, detectedPlatform: string | null, detectionReason: string | null, rejectedReason: string | null }}
 */
function diagnoseMeetingUrl(url) {
  const result = {
    url: url ?? null,
    hostname: null,
    detectedPlatform: null,
    detectionReason: null,
    rejectedReason: null,
  };

  if (!url?.trim()) {
    result.rejectedReason = "empty_or_missing_url";
    return result;
  }

  try {
    const parsed = new URL(url);
    result.hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      result.rejectedReason = `unsupported_protocol:${parsed.protocol}`;
      return result;
    }

    for (const { suffix, platformId } of MEETING_HOST_SUFFIXES) {
      if (hostnameMatchesSuffix(result.hostname, suffix)) {
        result.detectedPlatform = platformId;
        result.detectionReason = `hostname_suffix_match:${suffix}`;
        return result;
      }
    }

    result.rejectedReason = `hostname_not_supported:${result.hostname}`;
    return result;
  } catch {
    result.rejectedReason = "invalid_url";
    return result;
  }
}

function parseMeetingCode(url) {
  const platform = getMeetingPlatformFromUrl(url);
  if (!platform) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (platform.id === "google_meet") {
      const match = path.match(/\/([a-z]{3,}-[a-z]{3,}-[a-z]{3,})/i);
      return match?.[1] ?? null;
    }

    if (platform.id === "zoom") {
      const pathPatterns = [
        /\/wc\/(?:join|inmeeting|webinar|home)\/([^/?#]+)/i,
        /\/(?:j|w|join)\/([^/?#]+)/i,
      ];
      for (const pattern of pathPatterns) {
        const match = path.match(pattern);
        if (match?.[1]) {
          return match[1];
        }
      }
      return null;
    }

    if (platform.id === "teams") {
      const meetPath = path.match(/\/meet\/([^/?#]+)/i);
      if (meetPath?.[1]) {
        return meetPath[1];
      }
      const joinMatch = path.match(/meetup-join\/([^/?#]+)/i);
      if (joinMatch?.[1]) {
        return joinMatch[1].slice(0, 32);
      }
      const meetQuery = parsed.searchParams.get("p");
      if (meetQuery && /\/meet\b/i.test(path)) {
        return meetQuery.slice(0, 32);
      }
      return null;
    }
  } catch {
    // Invalid URL.
  }

  return null;
}
