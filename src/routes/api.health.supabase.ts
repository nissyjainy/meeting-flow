import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnvDiagnostics } from "@/lib/supabase/env-diagnostics";

export const Route = createFileRoute("/api/health/supabase")({
  server: {
    handlers: {
      GET: async () => {
        const diagnostics = getSupabaseEnvDiagnostics();

        let captureStatusProbe: { ok: boolean; error: string | null } = {
          ok: false,
          error: "SUPABASE_SERVICE_ROLE_KEY not configured",
        };

        const admin = getSupabaseAdminClient();
        if (admin) {
          const { error } = await admin
            .from("calendar_events")
            .select("capture_status")
            .limit(1);

          captureStatusProbe = {
            ok: !error,
            error: error?.message ?? null,
          };
        }

        return Response.json({
          ...diagnostics,
          captureStatusProbe,
        });
      },
    },
  },
});
