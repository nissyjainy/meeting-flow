import { describe, expect, it } from "vitest";
import { isValidExtensionRedirectUri } from "./auth-handshake.server";

describe("extension auth handshake", () => {
  it("accepts chromiumapp.org redirect URIs", () => {
    expect(isValidExtensionRedirectUri("https://pcllhohalhphfcomnaakjipmnfjafhie.chromiumapp.org/")).toBe(
      true,
    );
  });

  it("rejects non-extension redirect URIs", () => {
    expect(isValidExtensionRedirectUri("https://evil.example/callback")).toBe(false);
    expect(isValidExtensionRedirectUri("http://abc.chromiumapp.org/")).toBe(false);
  });
});
