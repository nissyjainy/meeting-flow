import { createFileRoute } from "@tanstack/react-router";
import { uploadCapturedMeetingRecording } from "@/lib/meetings/capture-upload.server";
import { normalizeUploadFile } from "@/lib/meetings/normalize-upload-file";
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
        console.info("[extension-upload] POST received");

        const accessToken = parseBearerToken(request);
        if (!accessToken) {
          console.warn("[extension-upload] missing bearer token");
          return jsonResponse({ error: "Missing Authorization Bearer token." }, 401);
        }

        const supabase = createSupabaseBearerClient(accessToken);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(accessToken);

        if (authError || !user) {
          console.warn("[extension-upload] auth failed", authError?.message);
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

        const fallbackName =
          String(formData.get("fileName") ?? "").trim() || "meet-capture.webm";
        const file = normalizeUploadFile(formData.get("file"), fallbackName);
        if (!file) {
          console.warn("[extension-upload] missing or empty file field");
          return jsonResponse({ error: "Missing or empty file field." }, 400);
        }

        const meetUrl = String(formData.get("meetUrl") ?? "").trim() || null;
        const meetTitle = String(formData.get("meetTitle") ?? "").trim() || null;

        console.info("[extension-upload] uploading", {
          userId: user.id,
          fileName: file.name,
          bytes: file.size,
          meetUrl,
        });

        try {
          const result = await uploadCapturedMeetingRecording({
            supabase,
            userId: user.id,
            file,
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

          console.info("[extension-upload] success", { meetingId: result.meeting.id });

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
          console.error("[extension-upload] failed", message);
          return jsonResponse({ error: message }, 400);
        }
      },
    },
  },
});
