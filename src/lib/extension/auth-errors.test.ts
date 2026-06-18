import { describe, expect, it } from "vitest";
import {
  formatAuthErrorForCapture,
  formatAuthErrorForUpload,
  isAuthSessionError,
  SESSION_EXPIRED_UPLOAD_MESSAGE,
  SIGN_IN_AGAIN_MESSAGE,
} from "./auth-errors";

describe("extension auth errors", () => {
  it("detects refresh token failures", () => {
    expect(isAuthSessionError("Invalid Refresh Token: Refresh Token Not Found")).toBe(true);
    expect(isAuthSessionError("Session expired. Sign in again.")).toBe(true);
    expect(isAuthSessionError("Upload failed (HTTP 500).")).toBe(false);
  });

  it("formats upload auth errors", () => {
    expect(formatAuthErrorForUpload("Invalid Refresh Token: Refresh Token Not Found")).toBe(
      SESSION_EXPIRED_UPLOAD_MESSAGE,
    );
  });

  it("formats capture auth errors", () => {
    expect(formatAuthErrorForCapture("Invalid Refresh Token: Refresh Token Not Found")).toBe(
      SIGN_IN_AGAIN_MESSAGE,
    );
  });
});
