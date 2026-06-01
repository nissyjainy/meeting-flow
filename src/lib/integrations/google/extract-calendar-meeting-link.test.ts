import { describe, expect, it } from "vitest";
import { extractCalendarMeetingLink } from "./extract-calendar-meeting-link";

describe("extractCalendarMeetingLink", () => {
  it("prefers conferenceData video entry point", () => {
    const result = extractCalendarMeetingLink({
      conferenceData: {
        entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }],
      },
      location: "https://zoom.us/j/999",
    });

    expect(result.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(result.platform).toBe("Google Meet");
  });

  it("falls back to hangoutLink", () => {
    const result = extractCalendarMeetingLink({
      hangoutLink: "https://meet.google.com/xyz-uvwx-rst",
    });

    expect(result.meetingUrl).toBe("https://meet.google.com/xyz-uvwx-rst");
    expect(result.platform).toBe("Google Meet");
  });

  it("extracts Zoom link from location", () => {
    const result = extractCalendarMeetingLink({
      location: "Zoom: https://zoom.us/j/123456789",
    });

    expect(result.meetingUrl).toBe("https://zoom.us/j/123456789");
    expect(result.platform).toBe("Zoom");
  });

  it("extracts Teams link from description", () => {
    const result = extractCalendarMeetingLink({
      description: "Microsoft Teams meeting\nhttps://teams.microsoft.com/l/meetup-join/abc123",
    });

    expect(result.meetingUrl).toBe("https://teams.microsoft.com/l/meetup-join/abc123");
    expect(result.platform).toBe("Microsoft Teams");
  });

  it("returns null when no link is found", () => {
    expect(extractCalendarMeetingLink({ location: "Conference Room B" })).toEqual({
      meetingUrl: null,
      platform: null,
    });
  });
});
