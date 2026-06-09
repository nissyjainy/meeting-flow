import { describe, expect, it } from "vitest";

const MIC_NOT_ALLOWED_CAPTURE_MESSAGE =
  "Microphone access is required to record your voice. Click Start Capture to retry.";

describe("extension microphone permission UX", () => {
  it("uses a retry-friendly message for NotAllowedError", () => {
    expect(MIC_NOT_ALLOWED_CAPTURE_MESSAGE).toContain("Click Start Capture to retry");
    expect(MIC_NOT_ALLOWED_CAPTURE_MESSAGE).toContain("Microphone access is required");
  });

  it("formats non-permission errors with name and message", () => {
    const error = { name: "NotFoundError", message: "Requested device not found" };
    const label = `Microphone error: ${error.name}: ${error.message}`;
    expect(label).toBe("Microphone error: NotFoundError: Requested device not found");
  });
});
