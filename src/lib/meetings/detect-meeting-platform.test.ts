import { describe, expect, it } from "vitest";
import { detectMeetingPlatform, findMeetingUrlInText } from "./detect-meeting-platform";

describe("detectMeetingPlatform", () => {
  it("detects Google Meet", () => {
    expect(detectMeetingPlatform("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
    expect(detectMeetingPlatform("https://hangouts.google.com/call/123")).toBe("Google Meet");
  });

  it("detects Zoom", () => {
    expect(detectMeetingPlatform("https://zoom.us/j/123456789")).toBe("Zoom");
    expect(detectMeetingPlatform("https://us02web.zoom.us/j/123456789?pwd=abc")).toBe("Zoom");
  });

  it("detects Microsoft Teams", () => {
    expect(
      detectMeetingPlatform("https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc"),
    ).toBe("Microsoft Teams");
    expect(detectMeetingPlatform("https://teams.live.com/meet/123456789")).toBe("Microsoft Teams");
  });

  it("returns Unknown for unrecognized URLs", () => {
    expect(detectMeetingPlatform("https://example.com/meeting")).toBe("Unknown");
    expect(detectMeetingPlatform("")).toBe("Unknown");
  });
});

describe("findMeetingUrlInText", () => {
  it("extracts the first known platform URL from text", () => {
    expect(
      findMeetingUrlInText("Join Zoom: https://zoom.us/j/123456789 — see you there."),
    ).toBe("https://zoom.us/j/123456789");
  });

  it("prefers known platform URLs over unknown links", () => {
    expect(
      findMeetingUrlInText(
        "Room: https://example.com/x Teams: https://teams.microsoft.com/l/meetup-join/abc",
      ),
    ).toBe("https://teams.microsoft.com/l/meetup-join/abc");
  });
});
