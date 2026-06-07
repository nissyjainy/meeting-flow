import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildGoogleOAuthUrl } from "@/lib/integrations/google/oauth";
import { getGoogleOAuthConfig } from "@/lib/integrations/google/env";
import { googleOAuthDebug } from "@/lib/integrations/google/oauth-debug";
import {
  redirectWithOAuthStateCookie,
  validateOAuthOriginsMatch,
} from "@/lib/integrations/google/oauth-state-cookie";
import {
  redirectResponse,
  settingsRedirectUrl,
} from "@/lib/integrations/google/settings-redirect";
import { getGoogleOAuthAppBase } from "@/lib/integrations/google/env";

export const Route = createFileRoute("/api/integrations/google/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const appBase = getGoogleOAuthAppBase(request.url);
        const config = getGoogleOAuthConfig(request.url);

        if (!config) {
          return redirectResponse(settingsRedirectUrl(appBase, { error: "not_configured" }));
        }

        const originCheck = validateOAuthOriginsMatch(request.url, config.redirectUri);
        if (!originCheck.ok) {
          googleOAuthDebug("connect:host-mismatch", {
            requestOrigin: originCheck.requestOrigin,
            redirectOrigin: originCheck.redirectOrigin,
            redirectUri: config.redirectUri,
          });
          return redirectResponse(
            settingsRedirectUrl(appBase, {
              error: `host_mismatch: use ${originCheck.redirectOrigin} (not ${originCheck.requestOrigin})`,
            }),
          );
        }

        const supabase = getSupabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return redirectResponse(new URL("/login", appBase).toString());
        }

        const nonce = crypto.randomUUID();
        const stateValue = `${user.id}:${nonce}`;
        const authUrl = buildGoogleOAuthUrl(config, stateValue);

        googleOAuthDebug("connect:start", {
          redirectUri: config.redirectUri,
          requestUrl: request.url,
          userId: user.id,
        });

        return redirectWithOAuthStateCookie(authUrl, stateValue, request);
      },
    },
  },
});
