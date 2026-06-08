import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const Route = createFileRoute("/api/health/meetings-schema")({
  server: {
    handlers: {
      GET: async () => {
        const admin = getSupabaseAdminClient();

        let transcriptErrorColumn: { ok: boolean; error: string | null } = {
          ok: false,
          error: "SUPABASE_SERVICE_ROLE_KEY not configured",
        };

        if (admin) {
          const { error } = await admin
            .from("meetings")
            .select("transcript_error")
            .limit(1);

          transcriptErrorColumn = {
            ok: !error,
            error: error?.message ?? null,
          };
        }

        return Response.json({
          transcriptErrorColumn,
          requiredMigration: "supabase/migrations/20260521000000_meeting_transcript_error.sql",
        });
      },
    },
  },
});
