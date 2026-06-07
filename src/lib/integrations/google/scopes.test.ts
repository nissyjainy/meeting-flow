import { describe, expect, it } from "vitest";
import {
  GOOGLE_INTEGRATION_SCOPES,
  GOOGLE_MEET_READONLY_SCOPE,
  hasMeetTranscriptScope,
} from "./scopes";

describe("hasMeetTranscriptScope", () => {
  it("returns true when meet readonly scope is present", () => {
    expect(hasMeetTranscriptScope([...GOOGLE_INTEGRATION_SCOPES])).toBe(true);
    expect(hasMeetTranscriptScope([GOOGLE_MEET_READONLY_SCOPE])).toBe(true);
  });

  it("returns false for calendar-only scopes", () => {
    expect(
      hasMeetTranscriptScope(["https://www.googleapis.com/auth/calendar.readonly"]),
    ).toBe(false);
  });

  it("returns false for empty scopes", () => {
    expect(hasMeetTranscriptScope([])).toBe(false);
    expect(hasMeetTranscriptScope(null)).toBe(false);
  });
});
