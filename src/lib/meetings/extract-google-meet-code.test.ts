import { describe, expect, it } from "vitest";
import { extractGoogleMeetCode } from "./extract-google-meet-code";

describe("extractGoogleMeetCode", () => {
  it("parses standard meet URLs", () => {
    expect(extractGoogleMeetCode("https://meet.google.com/abc-defg-hij")).toBe("abc-defg-hij");
  });

  it("ignores query params", () => {
    expect(extractGoogleMeetCode("https://meet.google.com/xyz-uvwx-rst?hs=122")).toBe("xyz-uvwx-rst");
  });

  it("returns null for non-meet URLs", () => {
    expect(extractGoogleMeetCode("https://zoom.us/j/123")).toBeNull();
    expect(extractGoogleMeetCode(null)).toBeNull();
  });
});
