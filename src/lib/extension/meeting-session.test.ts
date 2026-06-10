import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type MeetingSessionModule = {
  isCaptureTabSessionEnded: (
    tab: { url?: string; title?: string } | null,
    captureState: {
      recording?: boolean;
      meetUrl?: string | null;
      meetCode?: string | null;
      tabTitle?: string | null;
    },
  ) => boolean;
  isGoogleMeetEndedTitle: (title: string) => boolean;
};

function loadMeetingSession(): MeetingSessionModule {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../extension");
  const platformCode = readFileSync(path.join(root, "meeting-platform.js"), "utf8");
  const sessionCode = readFileSync(path.join(root, "meeting-session.js"), "utf8");
  const sandbox: Record<string, unknown> = { URL };
  runInNewContext(`${platformCode}\n${sessionCode}`, sandbox);
  return {
    isCaptureTabSessionEnded: sandbox.isCaptureTabSessionEnded as MeetingSessionModule["isCaptureTabSessionEnded"],
    isGoogleMeetEndedTitle: sandbox.isGoogleMeetEndedTitle as MeetingSessionModule["isGoogleMeetEndedTitle"],
  };
}

describe("meeting-session detection", () => {
  const session = loadMeetingSession();

  const activeState = {
    recording: true,
    meetUrl: "https://meet.google.com/abc-defg-hij",
    meetCode: "abc-defg-hij",
    tabTitle: "Team sync - abc-defg-hij",
  };

  it("detects closed capture tab", () => {
    expect(session.isCaptureTabSessionEnded(null, activeState)).toBe(true);
  });

  it("detects navigation away from meeting host", () => {
    expect(
      session.isCaptureTabSessionEnded(
        { url: "https://example.com/", title: "Example" },
        activeState,
      ),
    ).toBe(true);
  });

  it("detects meet code removed from URL", () => {
    expect(
      session.isCaptureTabSessionEnded(
        { url: "https://meet.google.com/", title: "Google Meet" },
        activeState,
      ),
    ).toBe(true);
  });

  it("detects Google Meet ended title on same URL", () => {
    expect(session.isGoogleMeetEndedTitle("You left the meeting")).toBe(true);
    expect(
      session.isCaptureTabSessionEnded(
        {
          url: "https://meet.google.com/abc-defg-hij",
          title: "You left the meeting",
        },
        activeState,
      ),
    ).toBe(true);
  });

  it("does not flag active meet session", () => {
    expect(
      session.isCaptureTabSessionEnded(
        {
          url: "https://meet.google.com/abc-defg-hij",
          title: "Team sync - abc-defg-hij",
        },
        activeState,
      ),
    ).toBe(false);
  });

  it("ignores checks when not recording", () => {
    expect(
      session.isCaptureTabSessionEnded(
        { url: "https://meet.google.com/", title: "Google Meet" },
        { recording: false, meetUrl: activeState.meetUrl, meetCode: activeState.meetCode },
      ),
    ).toBe(false);
  });
});
