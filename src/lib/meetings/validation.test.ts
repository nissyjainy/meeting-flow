import { describe, expect, it } from "vitest";
import {
  baseMeetingMimeType,
  isAllowedMeetingMimeType,
  normalizeMeetingMimeType,
  validateMeetingFile,
} from "./validation";

describe("meeting MIME validation", () => {
  it("accepts webm base and codec-parameter variants", () => {
    expect(isAllowedMeetingMimeType("audio/webm")).toBe(true);
    expect(isAllowedMeetingMimeType("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedMeetingMimeType("video/webm")).toBe(true);
    expect(isAllowedMeetingMimeType("video/webm;codecs=vp9")).toBe(true);
  });

  it("still accepts legacy upload types", () => {
    expect(isAllowedMeetingMimeType("audio/mpeg")).toBe(true);
    expect(isAllowedMeetingMimeType("video/mp4")).toBe(true);
    expect(isAllowedMeetingMimeType("audio/wav")).toBe(true);
    expect(isAllowedMeetingMimeType("audio/m4a")).toBe(true);
  });

  it("rejects unknown MIME types", () => {
    expect(isAllowedMeetingMimeType("application/octet-stream")).toBe(false);
    expect(isAllowedMeetingMimeType("text/plain")).toBe(false);
  });

  it("strips codec parameters for storage content type", () => {
    expect(baseMeetingMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeMeetingMimeType("audio/webm;codecs=opus", "meet.webm")).toBe("audio/webm");
    expect(normalizeMeetingMimeType("video/webm;codecs=vp9", "meet.webm")).toBe("video/webm");
  });

  it("validates extension recordings with codec MIME types", () => {
    const file = new File(["audio"], "meet-capture.webm", {
      type: "audio/webm;codecs=opus",
    });
    expect(validateMeetingFile(file)).toEqual({ valid: true });
  });
});
