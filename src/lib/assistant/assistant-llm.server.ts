import { readServerEnv } from "@/lib/server-env";
import { assistantError, assistantLog, assistantPreview } from "./assistant-debug";

const GROQ_CHAT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
] as const;

type GroqChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
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

export async function generateAssistantAnswer(
  query: string,
  context: string,
): Promise<string> {
  const { apiKey, models } = getGroqChatConfig();

  assistantLog("LLM answer generation started", {
    queryPreview: assistantPreview(query, 200),
    contextLength: context.length,
    models,
  });

  const systemPrompt = `You are MeetFlow Assistant — an AI that answers questions across a user's meeting history.

Rules:
- Answer ONLY using the context provided below.
- The WORKSPACE ANALYTICS section contains pre-computed, authoritative data for reminders, overdue tasks, at-risk tasks, weekly focus, executive briefing, execution health, and best performer rankings. Prefer these figures when answering analytics questions.
- The RELEVANT MEETINGS section contains meeting summaries, transcript excerpts, and action items for semantic/topic questions.
- Be specific: cite meeting names, owners, deadlines, and decisions when available.
- If the context lacks enough information, say what is missing instead of inventing facts.
- For owner/task questions, match the logged-in user's email or name when the question says "me" or "my".
- Keep answers concise (2–6 short paragraphs or bullet lists).
- Do NOT include a Sources section — sources are appended separately by the application.`;

  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody = {
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Meeting context:\n\n${context}\n\n---\n\nUser question:\n${query}`,
        },
      ],
    };

    assistantLog("Groq chat request", {
      model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
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
      assistantLog("Groq chat response", {
        model,
        httpStatus: groqRes.status,
        ok: groqRes.ok,
        bodyPreview: assistantPreview(responseText, 1200),
      });

      if (!groqRes.ok) {
        throw new Error(
          `Groq assistant failed (HTTP ${groqRes.status})${responseText ? `: ${responseText}` : ""}`,
        );
      }

      const json = JSON.parse(responseText) as GroqChatCompletionResponse;
      if (json.error?.message) {
        throw new Error(`Groq API error: ${json.error.message}`);
      }

      const answer = json.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        throw new Error("Groq assistant returned empty text.");
      }

      assistantLog("LLM answer generation success", {
        model,
        answerLength: answer.length,
      });

      return answer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      assistantError("Groq model attempt failed", lastError, { model });
    }
  }

  throw lastError ?? new Error("All Groq models failed for assistant answer generation.");
}
