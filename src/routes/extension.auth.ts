import { createFileRoute } from "@tanstack/react-router";
import {
  createExtensionAuthCode,
  isValidExtensionRedirectUri,
} from "@/lib/extension/auth-handshake.server";
import { buildExtensionAuthRedirectUriCookie } from "@/lib/extension/extension-auth-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectResponse(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, {
    status: 302,
    headers,
  });
}

export const Route = createFileRoute("/extension/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectUri = url.searchParams.get("redirect_uri")?.trim() ?? "";
        const origin = url.origin;

        if (!isValidExtensionRedirectUri(redirectUri)) {
          return new Response("Invalid extension redirect URI.", { status: 400 });
        }

        const supabase = getSupabaseServerClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token || !session.user) {
          const extensionAuthPath = `/extension/auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
          const loginUrl = new URL("/login", origin);
          loginUrl.searchParams.set("redirect", extensionAuthPath);
          return redirectResponse(loginUrl.toString(), [
            buildExtensionAuthRedirectUriCookie(redirectUri),
          ]);
        }

        const expiresAt =
          session.expires_at != null ? session.expires_at * 1000 : Date.now() + 3600 * 1000;

        const code = await createExtensionAuthCode({
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? "",
          expiresAt,
          email: session.user.email ?? "",
          userId: session.user.id,
        });

        const callback = new URL(redirectUri);
        callback.searchParams.set("code", code);
        return redirectResponse(callback.toString());
      },
    },
  },
});
