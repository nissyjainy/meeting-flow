import { createFileRoute } from "@tanstack/react-router";
import {
  buildClearExtensionAuthRedirectUriCookie,
  resolvePostAuthRedirectPath,
  shouldClearExtensionAuthCookie,
} from "@/lib/extension/extension-auth-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function authRedirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, {
    status: 302,
    headers,
  });
}

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const origin = url.origin;

        if (!code) {
          return authRedirect(`${origin}/login?error=missing_code`);
        }

        const supabase = getSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("[auth-callback] exchangeCodeForSession failed", error.message);
          return authRedirect(`${origin}/login?error=auth_callback_failed`);
        }

        const destination = resolvePostAuthRedirectPath(
          url.searchParams.get("redirect"),
          request.headers.get("Cookie"),
        );
        const cookies = shouldClearExtensionAuthCookie(destination)
          ? [buildClearExtensionAuthRedirectUriCookie()]
          : [];

        return authRedirect(`${origin}${destination}`, cookies);
      },
    },
  },
});
