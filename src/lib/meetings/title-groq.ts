import { readServerEnv } from "@/lib/server-env";
import { summaryError, summaryLog, summaryPreview } from "./summary-debug";

/** Enough context for topic; title does not need the full transcript. */
const MAX_TRANSCRIPT_CHARS = 4_000;

const MAX_TITLE_CHARS = 80;

const GROQ_CHAT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
] as const;

type GroqChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    text?: string | null;
  }>;
  error?: { message?: string; type?: string };
};

function getGroqChatConfig() {
  const apiKey = readServerEnv("GROQ_API_KEY");
  const preferred = readServerEnv("GROQ_CHAT_MODEL")?.trim();
  const models = preferred
    ? [preferred, ...GROQ_CHAT_FALLBACK_MODELS.filter((m) => m !== preferred)]
    : [...GROQ_CHAT_FALLBACK_MODELS];

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY. Add it to your server env (see .env.example).");
  }

  return { apiKey, models };
}

function truncateTranscriptForTitle(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= MAX_TRANSCRIPT_CHARS) return trimmed;
  summaryLog("transcript truncated for AI title", {
    originalLength: trimmed.length,
    maxChars: MAX_TRANSCRIPT_CHARS,
  });
  return trimmed.slice(0, MAX_TRANSCRIPT_CHARS);
}

function parseGroqTitleResponse(json: GroqChatCompletionResponse): string {
  if (json.error?.message) {
    throw new Error(`Groq API error: ${json.error.message}`);
  }

  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? "";
  return (typeof content === "string" ? content : "").trim();
}

export function sanitizeMeetingTitle(raw: string | null | undefined): string | null {
  let title = raw?.trim() ?? "";
  if (!title) return null;

  title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
  title = title.replace(/\s+/g, " ");
  title = title.replace(/[.!?]+$/g, "").trim();

  if (!title) return null;
  if (title.length > MAX_TITLE_CHARS) {
    title = title.slice(0, MAX_TITLE_CHARS).trim();
  }

  return title || null;
}

export async function generateMeetingTitleFromTranscript(transcript: string): Promise<string> {
  const payload = truncateTranscriptForTitle(transcript);
  if (!payload) {
    throw new Error("Cannot generate title from empty transcript.");
  }

  const { apiKey, models } = getGroqChatConfig();
  summaryLog("AI title generation started", {
    transcriptLength: payload.length,
    models,
    hasApiKey: Boolean(apiKey),
  });

  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody = {
      model,
      temperature: 0.2,
      max_tokens: 48,
      messages: [
        {
          role: "system",
          content:
            "You write short meeting titles. Return only a plain title of 5–8 words describing the main topic. No quotes, markdown, punctuation at the end, or prefixes like 'Meeting about'.",
        },
        {
          role: "user",
          content: `Transcript excerpt:\n\n${payload}`,
        },
      ],
    };

    summaryLog("AI title Groq request", {
      model,
      transcriptLength: payload.length,
      userMessagePreview: summaryPreview(requestBody.messages[1].content),
    });

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await groqRes.text();
      summaryLog("AI title Groq raw response", {
        model,
        httpStatus: groqRes.status,
        ok: groqRes.ok,
        bodyPreview: summaryPreview(responseText, 1000),
      });

      if (!groqRes.ok) {
        throw new Error(
          `Groq title failed (HTTP ${groqRes.status})${responseText ? `: ${responseText}` : ""}`,
        );
      }

      let json: GroqChatCompletionResponse;
      try {
        json = JSON.parse(responseText) as GroqChatCompletionResponse;
      } catch (parseErr) {
        summaryError("AI title Groq JSON parse failed", parseErr, { model, responseText });
        throw new Error("Groq returned non-JSON response for title generation.");
      }

      const rawTitle = parseGroqTitleResponse(json);
      const title = sanitizeMeetingTitle(rawTitle);
      if (!title) {
        throw new Error("Title generation returned empty text after sanitization.");
      }

      summaryLog("AI title extracted", { model, titleLength: title.length });
      return title;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      summaryError("AI title Groq model attempt failed", lastError, { model });
    }
  }

  throw lastError ?? new Error("All Groq chat models failed for title generation.");
}
