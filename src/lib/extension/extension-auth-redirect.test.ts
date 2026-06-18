import { describe, expect, it } from "vitest";
import {
  buildClearExtensionAuthRedirectUriCookie,
  buildExtensionAuthPath,
  buildExtensionAuthRedirectUriCookie,
  EXTENSION_AUTH_REDIRECT_URI_COOKIE,
  parseExtensionRedirectUriFromAuthPath,
  readExtensionRedirectUriCookie,
  resolvePostAuthRedirectPath,
  shouldClearExtensionAuthCookie,
} from "./extension-auth-redirect";

const CHROMIUM_REDIRECT_URI = "https://abcdefghijklmnop.chromiumapp.org/";

describe("extension auth redirect helpers", () => {
  it("builds and parses extension auth paths", () => {
    const path = buildExtensionAuthPath(CHROMIUM_REDIRECT_URI);
    expect(path).toBe(
      "/extension/auth?redirect_uri=https%3A%2F%2Fabcdefghijklmnop.chromiumapp.org%2F",
    );
    expect(parseExtensionRedirectUriFromAuthPath(path)).toBe(CHROMIUM_REDIRECT_URI);
  });

  it("rejects invalid extension auth paths", () => {
    expect(parseExtensionRedirectUriFromAuthPath("/meetings")).toBeNull();
    expect(parseExtensionRedirectUriFromAuthPath("/extension/auth?redirect_uri=http://bad")).toBeNull();
  });

  it("reads and writes the extension redirect cookie", () => {
    const cookie = buildExtensionAuthRedirectUriCookie(CHROMIUM_REDIRECT_URI);
    expect(cookie).toContain(`${EXTENSION_AUTH_REDIRECT_URI_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");

    const header = `${cookie}; sb-access-token=abc`;
    expect(readExtensionRedirectUriCookie(header)).toBe(CHROMIUM_REDIRECT_URI);
    expect(readExtensionRedirectUriCookie("other=value")).toBeNull();
  });

  it("clears the extension redirect cookie", () => {
    expect(buildClearExtensionAuthRedirectUriCookie()).toContain("Max-Age=0");
  });
});

describe("resolvePostAuthRedirectPath", () => {
  const extensionPath = buildExtensionAuthPath(CHROMIUM_REDIRECT_URI);
  const cookieHeader = buildExtensionAuthRedirectUriCookie(CHROMIUM_REDIRECT_URI);

  it("uses explicit redirect when present", () => {
    expect(resolvePostAuthRedirectPath("/meetings", null)).toBe("/meetings");
    expect(resolvePostAuthRedirectPath(extensionPath, null)).toBe(extensionPath);
  });

  it("recovers extension auth when OAuth drops redirect query param", () => {
    expect(resolvePostAuthRedirectPath(null, cookieHeader)).toBe(extensionPath);
    expect(resolvePostAuthRedirectPath("", cookieHeader)).toBe(extensionPath);
  });

  it("falls back to dashboard when no extension context exists", () => {
    expect(resolvePostAuthRedirectPath(null, null)).toBe("/");
  });

  it("prefers explicit redirect over cookie", () => {
    expect(resolvePostAuthRedirectPath("/tasks", cookieHeader)).toBe("/tasks");
  });
});

describe("extension auth flow scenarios", () => {
  const extensionPath = buildExtensionAuthPath(CHROMIUM_REDIRECT_URI);
  const cookieHeader = buildExtensionAuthRedirectUriCookie(CHROMIUM_REDIRECT_URI);

  it("/extension/auth -> login preserves recovery via cookie when OAuth redirect is lost", () => {
    const afterOAuth = resolvePostAuthRedirectPath(null, cookieHeader);
    expect(afterOAuth).toBe(extensionPath);
    expect(shouldClearExtensionAuthCookie(afterOAuth)).toBe(true);
  });

  it("Google OAuth -> callback -> extension auth when redirect param survives", () => {
    const afterOAuth = resolvePostAuthRedirectPath(extensionPath, cookieHeader);
    expect(afterOAuth).toBe(extensionPath);
  });

  it("existing session -> extension auth uses full path with redirect_uri", () => {
    const parsed = parseExtensionRedirectUriFromAuthPath(extensionPath);
    expect(parsed).toBe(CHROMIUM_REDIRECT_URI);
    expect(buildExtensionAuthPath(parsed!)).toBe(extensionPath);
  });
});
