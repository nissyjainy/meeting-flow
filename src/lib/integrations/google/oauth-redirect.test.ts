import { describe, expect, it } from "vitest";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  googleOAuthRedirectUriFromRequest,
  resolveGoogleOAuthRedirectUri,
} from "./oauth-redirect";

const PRODUCTION_REQUEST = "https://meeting-flow.nisargjain.workers.dev/api/integrations/google/connect";
const PRODUCTION_CALLBACK =
  "https://meeting-flow.nisargjain.workers.dev/api/integrations/google/callback";

describe("resolveGoogleOAuthRedirectUri", () => {
  it("uses request origin when APP_URL is localhost but request is production", () => {
    expect(
      resolveGoogleOAuthRedirectUri(PRODUCTION_REQUEST, {
        appUrl: "http://localhost:8080",
      }),
    ).toBe(PRODUCTION_CALLBACK);
  });

  it("uses request origin when explicit redirect is localhost but request is production", () => {
    expect(
      resolveGoogleOAuthRedirectUri(PRODUCTION_REQUEST, {
        appUrl: "http://localhost:8080",
        explicitRedirectUri: "http://localhost:8080/api/integrations/google/callback",
      }),
    ).toBe(PRODUCTION_CALLBACK);
  });

  it("keeps explicit production redirect when it matches the deployment", () => {
    expect(
      resolveGoogleOAuthRedirectUri(PRODUCTION_REQUEST, {
        explicitRedirectUri: PRODUCTION_CALLBACK,
      }),
    ).toBe(PRODUCTION_CALLBACK);
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
    expect(googleOAuthRedirectUriFromRequest(PRODUCTION_REQUEST)).toBe(PRODUCTION_CALLBACK);
  });
});
