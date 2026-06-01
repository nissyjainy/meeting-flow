import { describe, expect, it } from "vitest";
import { buildOAuthRedirectUrl, normalizeAuthRedirectPath } from "./redirect-path";

describe("normalizeAuthRedirectPath", () => {
  it("returns default for empty input", () => {
    expect(normalizeAuthRedirectPath()).toBe("/");
    expect(normalizeAuthRedirectPath("")).toBe("/");
  });

  it("keeps valid path-only redirects", () => {
    expect(normalizeAuthRedirectPath("/meetings")).toBe("/meetings");
    expect(normalizeAuthRedirectPath("/meetings?upload=1")).toBe("/meetings?upload=1");
  });

  it("extracts path from full URLs", () => {
    expect(normalizeAuthRedirectPath("http://localhost:8080/meetings")).toBe("/meetings");
    expect(normalizeAuthRedirectPath("https://app.example.com/tasks?filter=todo")).toBe(
      "/tasks?filter=todo",
    );
  });

  it("rejects invalid paths", () => {
    expect(normalizeAuthRedirectPath("meetings")).toBe("/");
    expect(normalizeAuthRedirectPath("//evil.com/phish")).toBe("/");
  });
});

describe("buildOAuthRedirectUrl", () => {
  it("does not double-concatenate origin", () => {
    expect(buildOAuthRedirectUrl("http://localhost:8080", "http://localhost:8080/meetings")).toBe(
      "http://localhost:8080/meetings",
    );
  });
});
