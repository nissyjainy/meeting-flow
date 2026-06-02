import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readServerEnv } from "@/lib/server-env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MEETINGS_BUCKET } from "./constants";
import { uploadDebug, uploadDebugError, uploadDebugReturn } from "./upload-debug";
import { mimeTypeFromFileName } from "./validation";

const TranscribeMeetingInput = z.object({
  meetingId: z.string().uuid(),
});

type GroqWhisperResponse = {
  text?: string;
};

function getGroqConfig() {
  uploadDebug("transcription getGroqConfig started (server)");
  try {
    const apiKey = readServerEnv("GROQ_API_KEY");
    const model = readServerEnv("GROQ_WHISPER_MODEL") || "whisper-large-v3";

    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY. Add it to your server env (see .env.example).");
    }

    uploadDebug("transcription getGroqConfig success (server)", {
      model,
      hasApiKey: Boolean(apiKey),
    });
    return { apiKey, model };
  } catch (error) {
    uploadDebugError("transcription getGroqConfig failed (server)", error);
    throw error;
  }
}

export const transcribeMeetingFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    uploadDebug("transcription inputValidator started (server)");
    try {
      const parsed = TranscribeMeetingInput.parse(data);
      uploadDebug("transcription inputValidator success (server)", {
        meetingId: parsed.meetingId,
      });
      return parsed;
    } catch (error) {
      uploadDebugError("transcription inputValidator failed (server)", error, { data });
      throw error;
    }
  })
  .handler(async ({ data }) => {
    uploadDebug("transcription handler started (server)", { meetingId: data.meetingId });

    try {
      const supabase = getSupabaseServerClient();

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id,file_name,file_url,transcript")
        .eq("id", data.meetingId)
        .maybeSingle();

      if (meetingError) {
        uploadDebugError("transcription fetch meeting failed (server)", meetingError);
        throw new Error(meetingError.message);
      }
      if (!meeting) {
        const err = new Error("Meeting not found.");
        uploadDebugError("transcription meeting not found (server)", err);
        throw err;
      }
      if (!meeting.file_url) {
        const err = new Error("Meeting has no file URL.");
        uploadDebugError("transcription missing file_url (server)", err);
        throw err;
      }

      uploadDebug("transcription createSignedUrl started (server)", {
        fileUrl: meeting.file_url,
      });

      const { data: signed, error: signedErr } = await supabase.storage
        .from(MEETINGS_BUCKET)
        .createSignedUrl(meeting.file_url, 10 * 60);

      if (signedErr) {
        uploadDebugError("transcription createSignedUrl failed (server)", signedErr);
        throw new Error(signedErr.message);
      }
      if (!signed?.signedUrl) {
        const err = new Error("Could not create signed URL for uploaded file.");
        uploadDebugError("transcription missing signedUrl (server)", err);
        throw err;
      }

      uploadDebug("transcription download file started (server)");
      const fileRes = await fetch(signed.signedUrl);
      if (!fileRes.ok) {
        const err = new Error(`Could not download uploaded file (HTTP ${fileRes.status}).`);
        uploadDebugError("transcription download file failed (server)", err, {
          status: fileRes.status,
        });
        throw err;
      }

      const buf = await fileRes.arrayBuffer();
      uploadDebug("transcription download file success (server)", { bytes: buf.byteLength });

      const blob = new Blob([buf], {
        type: mimeTypeFromFileName(meeting.file_name),
      });

      const form = new FormData();
      const { apiKey, model } = getGroqConfig();

      form.set("model", model);
      form.set("file", blob, meeting.file_name || "meeting");

      uploadDebug("transcription Groq API request started (server)", { model });
      const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      if (!groqRes.ok) {
        const body = await groqRes.text().catch(() => "");
        const err = new Error(
          `Groq transcription failed (HTTP ${groqRes.status})${body ? `: ${body}` : ""}`,
        );
        uploadDebugError("transcription Groq API failed (server)", err, {
          status: groqRes.status,
          body,
        });
        throw err;
      }

      const json = (await groqRes.json()) as GroqWhisperResponse;
      const transcript = (json.text ?? "").trim();
      uploadDebug("transcription Groq API success (server)", {
        transcriptLength: transcript.length,
      });

      if (!transcript) {
        const err = new Error("Transcription completed but returned empty text.");
        uploadDebugError("transcription empty transcript (server)", err);
        throw err;
      }

      uploadDebug("transcription DB update started (server)", { meetingId: meeting.id });
      const { error: saveError } = await supabase
        .from("meetings")
        .update({ transcript, status: "processing" })
        .eq("id", meeting.id);

      if (saveError) {
        uploadDebugError("transcription DB update failed (server)", saveError);
        throw new Error(saveError.message);
      }

      uploadDebug("transcription success (server)", { meetingId: meeting.id });
      const result = { transcript };
      return uploadDebugReturn("transcribeMeetingFn handler success", result, {
        meetingId: meeting.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed";
      uploadDebugError("transcription handler catch (server)", err);
      throw new Error(message);
    }
  });
