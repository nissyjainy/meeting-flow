import { createFileRoute } from "@tanstack/react-router";
import { normalizeAuthRedirectPath } from "@/lib/auth/redirect-path";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function authRedirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: new Headers({ Location: location }),
  });
}

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const next = normalizeAuthRedirectPath(url.searchParams.get("redirect"));
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

        return authRedirect(`${origin}${next}`);
      },
    },
  },
});
