import { describe, expect, it } from "vitest";
import { normalizeUploadFile } from "./normalize-upload-file";

describe("normalizeUploadFile", () => {
  it("returns null for empty blob", () => {
    const blob = new Blob([], { type: "audio/webm" });
    expect(normalizeUploadFile(blob, "meet-capture.webm")).toBeNull();
  });

  it("wraps plain blob with fallback name", () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    const file = normalizeUploadFile(blob, "meet-capture.webm");
    expect(file?.name).toBe("meet-capture.webm");
    expect(file?.type).toBe("audio/webm");
    expect(file?.size).toBeGreaterThan(0);
  });

  it("normalizes codec-parameter MIME types on wrap", () => {
    const blob = new Blob(["audio"], { type: "audio/webm;codecs=opus" });
    const file = normalizeUploadFile(blob, "meet-capture.webm");
    expect(file?.type).toBe("audio/webm");
  });

  it("keeps file with name", () => {
    const file = new File(["audio"], "recording.webm", { type: "audio/webm" });
    const normalized = normalizeUploadFile(file, "fallback.webm");
    expect(normalized?.name).toBe("recording.webm");
  });
});
