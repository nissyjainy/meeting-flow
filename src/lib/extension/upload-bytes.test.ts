import { describe, expect, it } from "vitest";

function hasWebmEbmlHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

describe("extension upload binary validation", () => {
  it("accepts a valid WebM EBML header", () => {
    expect(hasWebmEbmlHeader(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
  });

  it("rejects the corrupted [object Object] payload", () => {
    const corrupted = new TextEncoder().encode("[object Object]");
    expect(corrupted.length).toBe(15);
    expect(hasWebmEbmlHeader(corrupted)).toBe(false);
  });
});
