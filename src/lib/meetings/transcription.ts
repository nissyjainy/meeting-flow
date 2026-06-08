import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readServerEnv } from "@/lib/server-env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MEETINGS_BUCKET } from "./constants";
import { markTranscriptionFailed } from "./mark-transcription-failed.server";
import { transcriptionError, transcriptionLog } from "./transcription-debug";
import { uploadDebugReturn } from "./upload-debug";
import { mimeTypeFromFileName } from "./validation";

const TranscribeMeetingInput = z.object({
  meetingId: z.string().uuid(),
});

type GroqWhisperResponse = {
  text?: string;
};

function getGroqConfig() {
  transcriptionLog("Groq config resolution started");
  try {
    const apiKey = readServerEnv("GROQ_API_KEY");
    const model = readServerEnv("GROQ_WHISPER_MODEL") || "whisper-large-v3";

    transcriptionLog("Groq config resolved", {
      model,
      hasApiKey: Boolean(apiKey),
    });

    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY. Add it to your server env (see .env.example).");
    }

    return { apiKey, model };
  } catch (error) {
    transcriptionError("Groq config resolution failed", error);
    throw error;
  }
}

export async function runTranscribeMeeting(
  meetingId: string,
  supabase: SupabaseClient,
): Promise<{ transcript: string }> {
  transcriptionLog("runTranscribeMeeting started", { meetingId });

  const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id,file_name,file_url,transcript")
    .eq("id", meetingId)
    .maybeSingle();

  if (meetingError) {
    transcriptionError("fetch meeting failed", meetingError, { meetingId });
    throw new Error(meetingError.message);
  }
  if (!meeting) {
    const err = new Error("Meeting not found.");
    transcriptionError("meeting not found", err, { meetingId });
    throw err;
  }
  if (!meeting.file_url) {
    const err = new Error("Meeting has no file URL.");
    transcriptionError("missing file_url", err, { meetingId });
    throw err;
  }

  transcriptionLog("createSignedUrl started", { meetingId: meeting.id, fileUrl: meeting.file_url });

  const { data: signed, error: signedErr } = await supabase.storage
    .from(MEETINGS_BUCKET)
    .createSignedUrl(meeting.file_url, 10 * 60);

  if (signedErr) {
    transcriptionError("createSignedUrl failed", signedErr, { meetingId: meeting.id });
    throw new Error(signedErr.message);
  }
  if (!signed?.signedUrl) {
    const err = new Error("Could not create signed URL for uploaded file.");
    transcriptionError("missing signedUrl", err, { meetingId: meeting.id });
    throw err;
  }

  transcriptionLog("download file started", { meetingId: meeting.id });
  const fileRes = await fetch(signed.signedUrl);
  if (!fileRes.ok) {
    const err = new Error(`Could not download uploaded file (HTTP ${fileRes.status}).`);
    transcriptionError("download file failed", err, {
      meetingId: meeting.id,
      status: fileRes.status,
    });
    throw err;
  }

  const buf = await fileRes.arrayBuffer();
  transcriptionLog("download file success", { meetingId: meeting.id, bytes: buf.byteLength });

  const blob = new Blob([buf], {
    type: mimeTypeFromFileName(meeting.file_name),
  });

  const form = new FormData();
  const { apiKey, model } = getGroqConfig();

  form.set("model", model);
  form.set("file", blob, meeting.file_name || "meeting");

  transcriptionLog("Groq Whisper request started", {
    meetingId: meeting.id,
    model,
    fileBytes: buf.byteLength,
    fileName: meeting.file_name,
  });

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const groqBody = await groqRes.text().catch(() => "");

  transcriptionLog("Groq Whisper response received", {
    meetingId: meeting.id,
    model,
    httpStatus: groqRes.status,
    ok: groqRes.ok,
    bodyPreview: groqBody.slice(0, 500),
  });

  if (!groqRes.ok) {
    const err = new Error(
      `Groq transcription failed (HTTP ${groqRes.status})${groqBody ? `: ${groqBody}` : ""}`,
    );
    transcriptionError("Groq Whisper request failed", err, {
      meetingId: meeting.id,
      status: groqRes.status,
      body: groqBody,
    });
    throw err;
  }

  let json: GroqWhisperResponse;
  try {
    json = JSON.parse(groqBody) as GroqWhisperResponse;
  } catch (parseErr) {
    transcriptionError("Groq Whisper JSON parse failed", parseErr, {
      meetingId: meeting.id,
      body: groqBody,
    });
    throw new Error("Groq returned non-JSON response for transcription.");
  }

  const transcript = (json.text ?? "").trim();
  transcriptionLog("Groq Whisper transcript extracted", {
    meetingId: meeting.id,
    transcriptLength: transcript.length,
  });

  if (!transcript) {
    const err = new Error("Transcription completed but returned empty text.");
    transcriptionError("empty transcript", err, { meetingId: meeting.id });
    throw err;
  }

  transcriptionLog("DB update started (transcript saved)", { meetingId: meeting.id });
  const { error: saveError } = await supabase
    .from("meetings")
    .update({ transcript, status: "processing", transcript_error: null })
    .eq("id", meeting.id);

  if (saveError) {
    transcriptionError("DB update failed", saveError, { meetingId: meeting.id });
    throw new Error(saveError.message);
  }

  transcriptionLog("runTranscribeMeeting success", { meetingId: meeting.id });
  return { transcript };
}

export const transcribeMeetingFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    transcriptionLog("input validation started");
    try {
      const parsed = TranscribeMeetingInput.parse(data);
      transcriptionLog("input validation success", { meetingId: parsed.meetingId });
      return parsed;
    } catch (error) {
      transcriptionError("input validation failed", error, { data });
      throw error;
    }
  })
  .handler(async ({ data }) => {
    transcriptionLog("handler started", { meetingId: data.meetingId });

    try {
      const supabase = getSupabaseServerClient();
      const result = await runTranscribeMeeting(data.meetingId, supabase);
      return uploadDebugReturn("transcribeMeetingFn handler success", result, {
        meetingId: data.meetingId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed";
      transcriptionError("handler catch — marking meeting failed", err, { meetingId: data.meetingId });

      try {
        const supabase = getSupabaseServerClient();
        await markTranscriptionFailed(supabase, data.meetingId, message);
      } catch (markErr) {
        transcriptionError("markTranscriptionFailed threw", markErr, { meetingId: data.meetingId });
      }

      throw new Error(message);
    }
  });
