/** Shared meeting platform detection for MeetFlow extension (background + popup). */

const MEETING_PLATFORMS = {
  google_meet: {
    id: "google_meet",
    label: "Google Meet",
    badgeText: "MEET",
    badgeColor: "#1a73e8",
    hostnames: ["meet.google.com"],
  },
  zoom: {
    id: "zoom",
    label: "Zoom",
    badgeText: "ZOOM",
    badgeColor: "#2d8cff",
    hostnames: ["zoom.us", "app.zoom.us"],
  },
  teams: {
    id: "teams",
    label: "Microsoft Teams",
    badgeText: "TEAM",
    badgeColor: "#6264a7",
    hostnames: ["teams.microsoft.com", "teams.live.com"],
  },
};

const SUPPORTED_HOST_HINT =
  "meet.google.com, app.zoom.us, zoom.us, teams.microsoft.com, or teams.live.com";

function hostnameMatches(hostname, allowedHostnames) {
  const normalized = hostname.toLowerCase();
  for (const host of allowedHostnames) {
    const allowed = host.toLowerCase();
    if (normalized === allowed || normalized.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

function getMeetingPlatformFromUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    for (const platform of Object.values(MEETING_PLATFORMS)) {
      if (hostnameMatches(hostname, platform.hostnames)) {
        return platform;
      }
    }

    // Regional Zoom hosts (e.g. us02web.zoom.us) are common in meeting links.
    if (hostname.endsWith(".zoom.us")) {
      return MEETING_PLATFORMS.zoom;
    }
  } catch {
    // Invalid URL.
  }
  return null;
}

function isMeetingUrl(url) {
  return getMeetingPlatformFromUrl(url) !== null;
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
      const match = path.match(/\/(?:j|w|wc\/join)\/([^/?#]+)/i);
      return match?.[1] ?? null;
    }

    if (platform.id === "teams") {
      const meetMatch = path.match(/\/meet\/([^/?#]+)/i);
      if (meetMatch) {
        return meetMatch[1];
      }
      const joinMatch = path.match(/meetup-join\/([^/?#]+)/i);
      return joinMatch?.[1]?.slice(0, 32) ?? null;
    }
  } catch {
    // Invalid URL.
  }

  return null;
}
