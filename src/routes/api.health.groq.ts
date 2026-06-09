import { createFileRoute } from "@tanstack/react-router";
import {
  isValidGroqApiKey,
  probeGroqApiKey,
} from "@/lib/meetings/groq-transcription.server";
import { maskSecret, resolveServerEnv } from "@/lib/server-env";

export const Route = createFileRoute("/api/health/groq")({
  server: {
    handlers: {
      GET: async () => {
        const apiKeyResolved = resolveServerEnv("GROQ_API_KEY");
        const whisperModel = resolveServerEnv("GROQ_WHISPER_MODEL");
        const chatModel = resolveServerEnv("GROQ_CHAT_MODEL");

        const key = apiKeyResolved.value;
        const keyFormatValid = isValidGroqApiKey(key);

        let modelsProbe: { ok: boolean; httpStatus: number; bodyPreview: string } | null = null;
        if (keyFormatValid && key) {
          modelsProbe = await probeGroqApiKey(key);
        }

        return Response.json({
          apiKey: {
            configured: Boolean(key),
            masked: maskSecret(key),
            source: apiKeyResolved.source,
            length: key?.length ?? 0,
            formatValid: keyFormatValid,
          },
          whisperModel: whisperModel.value ?? "whisper-large-v3",
          whisperModelSource: whisperModel.source,
          chatModel: chatModel.value ?? null,
          chatModelSource: chatModel.source,
          modelsProbe,
          transcriptionEndpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
        });
      },
    },
  },
});
