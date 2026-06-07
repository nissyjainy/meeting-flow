import { describe, expect, it } from "vitest";
import { assembleMeetTranscriptText } from "./assemble-meet-transcript";

describe("assembleMeetTranscriptText", () => {
  it("joins entry text with blank lines", () => {
    const result = assembleMeetTranscriptText([
      { text: "Hello team.", startTime: "2026-06-07T14:00:10.000Z" },
      { text: "Let's review priorities.", startTime: "2026-06-07T14:00:45.000Z" },
    ]);

    expect(result).toContain("Hello team.");
    expect(result).toContain("Let's review priorities.");
    expect(result).toContain("[");
  });

  it("skips empty entries", () => {
    expect(
      assembleMeetTranscriptText([
        { text: "   " },
        { text: "Only line" },
      ]),
    ).toBe("Only line");
  });

  it("returns empty string when no usable entries", () => {
    expect(assembleMeetTranscriptText([])).toBe("");
  });
});
