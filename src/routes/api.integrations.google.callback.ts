import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
} from "@/lib/integrations/google/oauth";
import { getGoogleOAuthAppBase, getGoogleOAuthConfig } from "@/lib/integrations/google/env";
import { googleOAuthDebug } from "@/lib/integrations/google/oauth-debug";
import {
  clearOAuthStateCookie,
  invalidStateReason,
  logOAuthCallbackValidation,
  oauthStatesMatch,
  readOAuthStateCookie,
} from "@/lib/integrations/google/oauth-state-cookie";
import {
  redirectResponse,
  settingsRedirectUrl,
} from "@/lib/integrations/google/settings-redirect";
import {
  saveGoogleCalendarConnection,
  syncGoogleCalendarForUser,
  deleteGoogleCalendarConnection,
} from "@/lib/integrations/google/sync-calendar.server";

export const Route = createFileRoute("/api/integrations/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const appBase = getGoogleOAuthAppBase(request.url);
        const config = getGoogleOAuthConfig(request.url);

        if (!config) {
          return redirectResponse(settingsRedirectUrl(appBase, { error: "not_configured" }));
        }

        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        if (error) {
          return redirectResponse(settingsRedirectUrl(appBase, { error }));
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieState = readOAuthStateCookie(request);

        logOAuthCallbackValidation(request, config.redirectUri, state, cookieState, code);

        clearOAuthStateCookie(request.url);

        if (!code || !state || !oauthStatesMatch(state, cookieState)) {
          const reason = invalidStateReason(code, state, cookieState);
          googleOAuthDebug("callback:invalid_state", { reason });
          return redirectResponse(settingsRedirectUrl(appBase, { error: "invalid_state" }));
        }

        const [userId] = state.split(":");
        const supabase = getSupabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.id !== userId) {
          return redirectResponse(settingsRedirectUrl(appBase, { error: "unauthorized" }));
        }

        try {
          const tokens = await exchangeGoogleAuthCode(config, code);
          if (!tokens.refresh_token) {
            return redirectResponse(
              settingsRedirectUrl(appBase, { error: "missing_refresh_token" }),
            );
          }

          const googleAccountEmail = await fetchGoogleAccountEmail(tokens.access_token);

          await saveGoogleCalendarConnection({
            userId: user.id,
            googleAccountEmail,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
          });

          const syncResult = await syncGoogleCalendarForUser(user.id);

          if (!syncResult.success) {
            googleOAuthDebug("callback:sync_failed", { error: syncResult.error });
            try {
              await deleteGoogleCalendarConnection(user.id);
            } catch (rollbackError) {
              googleOAuthDebug("callback:sync_rollback_failed", {
                error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
              });
            }
            return redirectResponse(
              settingsRedirectUrl(appBase, {
                error: syncResult.error ?? "calendar_sync_failed",
              }),
            );
          }

          googleOAuthDebug("callback:success", {
            userId: user.id,
            googleAccountEmail,
            importedCount: syncResult.importedCount,
          });
          return redirectResponse(settingsRedirectUrl(appBase, { connected: "1" }));
        } catch (callbackError) {
          const message =
            callbackError instanceof Error ? callbackError.message : "connect_failed";
          googleOAuthDebug("callback:error", { message });
          return redirectResponse(
            settingsRedirectUrl(appBase, { error: message.slice(0, 120) }),
          );
        }
      },
    },
  },
});
