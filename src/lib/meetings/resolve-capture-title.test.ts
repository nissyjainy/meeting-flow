import { describe, expect, it } from "vitest";
import {
  extractPlatformMeetingTitle,
  isGenericMeetingTitle,
  meetingUrlsLikelyMatch,
  resolveCaptureTitle,
} from "./resolve-capture-title";

describe("resolveCaptureTitle", () => {
  it("prefers calendar title over tab title", () => {
    expect(
      resolveCaptureTitle({
        calendarTitle: "Weekly product sync",
        tabTitle: "Zoom Meeting",
        meetingCode: "123456789",
      }),
    ).toBe("Weekly product sync");
  });

  it("extracts platform meeting title from Meet tab suffix", () => {
    expect(
      resolveCaptureTitle({
        tabTitle: "Design review - Google Meet",
        platform: "Google Meet",
      }),
    ).toBe("Design review");
  });

  it("uses tab title when not generic", () => {
    expect(
      resolveCaptureTitle({
        tabTitle: "Customer onboarding call",
        platform: "Zoom",
      }),
    ).toBe("Customer onboarding call");
  });

  it("falls back to meeting code", () => {
    expect(
      resolveCaptureTitle({
        tabTitle: "Zoom Meeting",
        meetingCode: "987654321",
        platform: "Zoom",
      }),
    ).toBe("987654321");
  });

  it("returns Untitled Meeting as last resort", () => {
    expect(
      resolveCaptureTitle({
        tabTitle: "Microsoft Teams",
        platform: "Microsoft Teams",
      }),
    ).toBe("Untitled Meeting");
  });
});

describe("extractPlatformMeetingTitle", () => {
  it("strips Zoom suffix", () => {
    expect(extractPlatformMeetingTitle("Roadmap review - Zoom", "Zoom")).toBe("Roadmap review");
  });

  it("rejects generic Zoom Meeting", () => {
    expect(extractPlatformMeetingTitle("Zoom Meeting", "Zoom")).toBeNull();
  });
});

describe("isGenericMeetingTitle", () => {
  it("detects meet code only titles", () => {
    expect(isGenericMeetingTitle("Meet - abc-defg-hij")).toBe(true);
  });
});

describe("meetingUrlsLikelyMatch", () => {
  it("matches equivalent meet URLs", () => {
    expect(
      meetingUrlsLikelyMatch(
        "https://meet.google.com/abc-defg-hij",
        "https://meet.google.com/abc-defg-hij/",
      ),
    ).toBe(true);
  });
});
