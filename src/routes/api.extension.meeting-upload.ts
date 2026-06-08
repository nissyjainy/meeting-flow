import { createFileRoute } from "@tanstack/react-router";
import { uploadCapturedMeetingRecording } from "@/lib/meetings/capture-upload.server";
import { runMeetingAiPipeline } from "@/lib/meetings/run-meeting-ai-pipeline.server";
import { createSupabaseBearerClient, parseBearerToken } from "@/lib/supabase/bearer-client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export const Route = createFileRoute("/api/extension/meeting-upload")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const accessToken = parseBearerToken(request);
        if (!accessToken) {
          return jsonResponse({ error: "Missing Authorization Bearer token." }, 401);
        }

        const supabase = createSupabaseBearerClient(accessToken);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(accessToken);

        if (authError || !user) {
          return jsonResponse(
            { error: authError?.message ?? "Invalid or expired session. Sign in again." },
            401,
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return jsonResponse({ error: "Expected multipart/form-data body." }, 400);
        }

        const fileEntry = formData.get("file");
        if (!(fileEntry instanceof File) || fileEntry.size === 0) {
          return jsonResponse({ error: "Missing or empty file field." }, 400);
        }

        const meetUrl = String(formData.get("meetUrl") ?? "").trim() || null;
        const meetTitle = String(formData.get("meetTitle") ?? "").trim() || null;

        try {
          const result = await uploadCapturedMeetingRecording({
            supabase,
            userId: user.id,
            file: fileEntry,
            metadata: {
              meetUrl,
              meetTitle,
              source: "chrome_extension",
            },
          });

          void runMeetingAiPipeline(result.meeting.id).catch((error) => {
            console.error("[extension-upload] background AI pipeline failed", error);
          });

          const origin = new URL(request.url).origin;

          return jsonResponse({
            ok: true,
            meetingId: result.meeting.id,
            fileName: result.meeting.file_name,
            storagePath: result.storagePath,
            meetUrl: result.metadata.meetUrl,
            meetTitle: result.metadata.meetTitle,
            capturedAt: result.metadata.capturedAt,
            viewUrl: `${origin}/meetings/${result.meeting.id}`,
            message: "Upload complete. Transcription started in MeetFlow.",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";
          return jsonResponse({ error: message }, 400);
        }
      },
    },
  },
});
