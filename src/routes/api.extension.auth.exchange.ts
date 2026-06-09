import { createFileRoute } from "@tanstack/react-router";
import { exchangeExtensionAuthCode } from "@/lib/extension/auth-handshake.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export const Route = createFileRoute("/api/extension/auth/exchange")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: { code?: string } = {};
        try {
          body = (await request.json()) as { code?: string };
        } catch {
          return jsonResponse({ error: "Expected JSON body." }, 400);
        }

        try {
          const session = await exchangeExtensionAuthCode(body.code ?? "");
          return jsonResponse({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt,
            email: session.email,
            userId: session.userId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not exchange authorization code.";
          return jsonResponse({ error: message }, 401);
        }
      },
    },
  },
});
