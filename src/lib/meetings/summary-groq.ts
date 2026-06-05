import { readServerEnv } from "@/lib/server-env";
import { summaryError, summaryLog, summaryPreview } from "./summary-debug";

/** Max transcript chars sent to Groq (avoids context / payload limits). */
const MAX_TRANSCRIPT_CHARS = 80_000;

const GROQ_CHAT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
] as const;

type GroqChatCompletionResponse = {
  id?: string;
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

function truncateTranscript(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= MAX_TRANSCRIPT_CHARS) return trimmed;
  summaryLog("transcript truncated for Groq", {
    originalLength: trimmed.length,
    maxChars: MAX_TRANSCRIPT_CHARS,
  });
  return trimmed.slice(0, MAX_TRANSCRIPT_CHARS);
}

function parseGroqSummaryResponse(json: GroqChatCompletionResponse): string {
  summaryLog("Groq response parsed", {
    model: json.model,
    choiceCount: json.choices?.length ?? 0,
    responsePreview: summaryPreview(JSON.stringify(json)),
  });

  if (json.error?.message) {
    throw new Error(`Groq API error: ${json.error.message}`);
  }

  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? "";
  const summary = (typeof content === "string" ? content : "").trim();

  if (!summary) {
    throw new Error("Summary generation returned empty text from Groq response.");
  }

  return summary;
}

export async function generateMeetingSummaryFromTranscript(transcript: string): Promise<string> {
  const payload = truncateTranscript(transcript);
  if (!payload) {
    throw new Error("Cannot generate summary from empty transcript.");
  }

  const { apiKey, models } = getGroqChatConfig();
  summaryLog("summary generation started", {
    transcriptLength: payload.length,
    models,
    hasApiKey: Boolean(apiKey),
  });
  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody = {
      model,
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You summarize meeting transcripts. Write a concise summary in plain English: 2–4 sentences covering main topics, decisions, and action items. No markdown headings.",
        },
        {
          role: "user",
          content: `Summarize this meeting transcript:\n\n${payload}`,
        },
      ],
    };

    summaryLog("Groq request payload", {
      model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
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
      summaryLog("Groq raw response", {
        model,
        httpStatus: groqRes.status,
        ok: groqRes.ok,
        bodyPreview: summaryPreview(responseText, 2000),
      });

      if (!groqRes.ok) {
        throw new Error(
          `Groq summary failed (HTTP ${groqRes.status})${responseText ? `: ${responseText}` : ""}`,
        );
      }

      let json: GroqChatCompletionResponse;
      try {
        json = JSON.parse(responseText) as GroqChatCompletionResponse;
      } catch (parseErr) {
        summaryError("Groq JSON parse failed", parseErr, { model, responseText });
        throw new Error("Groq returned non-JSON response for summary.");
      }

      const summary = parseGroqSummaryResponse(json);
      summaryLog("Groq summary extracted", { model, summaryLength: summary.length });
      return summary;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      summaryError("Groq model attempt failed", lastError, { model });
    }
  }

  throw lastError ?? new Error("All Groq chat models failed for summary generation.");
}
