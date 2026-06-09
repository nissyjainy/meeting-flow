import { describe, expect, it } from "vitest";
import { isValidGroqApiKey } from "./groq-transcription.server";

describe("isValidGroqApiKey", () => {
  it("accepts gsk_ keys", () => {
    expect(isValidGroqApiKey("gsk_" + "a".repeat(48))).toBe(true);
  });

  it("rejects placeholders and short keys", () => {
    expect(isValidGroqApiKey("your-groq-api-key")).toBe(false);
    expect(isValidGroqApiKey("gsk_short")).toBe(false);
    expect(isValidGroqApiKey(undefined)).toBe(false);
  });
});
