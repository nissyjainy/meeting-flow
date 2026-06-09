import { describe, expect, it } from "vitest";
import { sanitizeMeetingTitle } from "./title-groq";

describe("sanitizeMeetingTitle", () => {
  it("strips wrapping quotes and trailing punctuation", () => {
    expect(sanitizeMeetingTitle('"MeetFlow Production Verification."')).toBe(
      "MeetFlow Production Verification",
    );
  });

  it("collapses whitespace", () => {
    expect(sanitizeMeetingTitle("Groq   Transcription   Testing")).toBe(
      "Groq Transcription Testing",
    );
  });

  it("truncates long titles", () => {
    const long = "A".repeat(100);
    expect(sanitizeMeetingTitle(long)?.length).toBe(80);
  });

  it("returns null for empty input", () => {
    expect(sanitizeMeetingTitle("")).toBeNull();
    expect(sanitizeMeetingTitle("   ")).toBeNull();
    expect(sanitizeMeetingTitle(null)).toBeNull();
  });
});
