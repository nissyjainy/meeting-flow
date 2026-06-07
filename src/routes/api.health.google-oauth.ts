import { createFileRoute } from "@tanstack/react-router";
import { getGoogleOAuthConfig } from "@/lib/integrations/google/env";
import { resolveServerEnv } from "@/lib/server-env";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "@/lib/integrations/google/oauth-redirect";

export const Route = createFileRoute("/api/health/google-oauth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const config = getGoogleOAuthConfig(request.url);
        const appUrl = resolveServerEnv("APP_URL");
        const explicitRedirect = resolveServerEnv("GOOGLE_OAUTH_REDIRECT_URI");
        const clientId = resolveServerEnv("GOOGLE_CLIENT_ID");

        return Response.json({
          configured: Boolean(config),
          clientId: clientId.value ?? null,
          clientIdSource: clientId.source,
          redirectUriSent: config?.redirectUri ?? null,
          appUrlEnv: appUrl.value ?? null,
          appUrlSource: appUrl.source,
          explicitRedirectUriEnv: explicitRedirect.value ?? null,
          explicitRedirectSource: explicitRedirect.source,
          requestOrigin: new URL(request.url).origin,
          expectedProductionCallback: `${new URL(request.url).origin}${GOOGLE_OAUTH_CALLBACK_PATH}`,
        });
      },
    },
  },
});
