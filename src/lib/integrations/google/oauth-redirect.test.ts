import { describe, expect, it } from "vitest";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  googleOAuthRedirectUriFromRequest,
  resolveGoogleOAuthRedirectUri,
} from "./oauth-redirect";

const DEPLOYED_REQUEST = "https://your-app.workers.dev/api/integrations/google/connect";
const DEPLOYED_CALLBACK = "https://your-app.workers.dev/api/integrations/google/callback";

describe("resolveGoogleOAuthRedirectUri", () => {
  it("uses request origin when APP_URL is localhost but request is production", () => {
    expect(
      resolveGoogleOAuthRedirectUri(DEPLOYED_REQUEST, {
        appUrl: "http://localhost:8080",
      }),
    ).toBe(DEPLOYED_CALLBACK);
  });

  it("uses request origin when explicit redirect is localhost but request is production", () => {
    expect(
      resolveGoogleOAuthRedirectUri(DEPLOYED_REQUEST, {
        appUrl: "http://localhost:8080",
        explicitRedirectUri: "http://localhost:8080/api/integrations/google/callback",
      }),
    ).toBe(DEPLOYED_CALLBACK);
  });

  it("keeps explicit production redirect when it matches the deployment", () => {
    expect(
      resolveGoogleOAuthRedirectUri(DEPLOYED_REQUEST, {
        explicitRedirectUri: DEPLOYED_CALLBACK,
      }),
    ).toBe(DEPLOYED_CALLBACK);
  });

  it("ignores explicit redirect URIs that use the wrong callback path", () => {
    expect(
      resolveGoogleOAuthRedirectUri(DEPLOYED_REQUEST, {
        explicitRedirectUri: "https://your-app.workers.dev/api/auth/callback/google",
      }),
    ).toBe(DEPLOYED_CALLBACK);
  });

  it("falls back to APP_URL when no request is available", () => {
    expect(
      resolveGoogleOAuthRedirectUri(undefined, {
        appUrl: "http://localhost:8080",
      }),
    ).toBe(`http://localhost:8080${GOOGLE_OAUTH_CALLBACK_PATH}`);
  });
});

describe("googleOAuthRedirectUriFromRequest", () => {
  it("builds the callback path from the request origin", () => {
    expect(googleOAuthRedirectUriFromRequest(DEPLOYED_REQUEST)).toBe(DEPLOYED_CALLBACK);
  });
});
