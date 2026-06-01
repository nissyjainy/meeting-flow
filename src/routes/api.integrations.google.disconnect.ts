import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deleteGoogleCalendarConnection } from "@/lib/integrations/google/sync-calendar.server";

export const Route = createFileRoute("/api/integrations/google/disconnect")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = getSupabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        try {
          await deleteGoogleCalendarConnection(user.id);
          return Response.json({ success: true });
        } catch (error) {
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
