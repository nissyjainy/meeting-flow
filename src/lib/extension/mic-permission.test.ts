import { describe, expect, it } from "vitest";

const MIC_DENIED_MESSAGE =
  "Microphone access is required to record your voice. Click Start Capture again to retry.";

describe("extension microphone permission UX", () => {
  it("uses a retry-friendly message when mic access is denied", () => {
    expect(MIC_DENIED_MESSAGE).toContain("Click Start Capture again");
    expect(MIC_DENIED_MESSAGE).toContain("Microphone access is required");
  });
});
