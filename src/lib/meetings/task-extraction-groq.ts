import { z } from "zod";
import { readServerEnv } from "@/lib/server-env";
import { taskError, taskLog, taskPreview } from "./task-extraction-debug";

const MAX_TRANSCRIPT_CHARS = 80_000;

const GROQ_CHAT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
] as const;

const RawTaskSchema = z.object({
  task: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

const ExtractionResponseSchema = z.object({
  tasks: z.array(RawTaskSchema).default([]),
});

export type ExtractedMeetingTask = {
  task: string;
  owner: string | null;
  deadline: string | null;
};

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

function truncateTranscript(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= MAX_TRANSCRIPT_CHARS) return trimmed;
  taskLog("transcript truncated for task extraction", {
    originalLength: trimmed.length,
    maxChars: MAX_TRANSCRIPT_CHARS,
  });
  return trimmed.slice(0, MAX_TRANSCRIPT_CHARS);
}

function normalizeRawTask(raw: z.infer<typeof RawTaskSchema>): ExtractedMeetingTask | null {
  const taskText = (raw.task ?? raw.description ?? "").trim();
  if (!taskText) return null;

  const deadline = (raw.deadline ?? raw.due_date ?? null)?.trim() || null;
  const owner = raw.owner?.trim() || null;

  return { task: taskText, owner, deadline };
}

function parseExtractionJson(raw: string): ExtractedMeetingTask[] {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    taskError("AI extraction JSON parse failed", err, { raw: taskPreview(raw, 1200) });
    throw new Error("Groq returned invalid JSON for task extraction.");
  }

  taskLog("AI extraction response parsed", { preview: taskPreview(JSON.stringify(payload), 1200) });

  const parsed = ExtractionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    taskError("AI extraction schema validation failed", parsed.error, {
      raw: taskPreview(raw, 1200),
    });
    throw new Error("Groq task extraction response did not match expected schema.");
  }

  const tasks: ExtractedMeetingTask[] = [];
  for (const item of parsed.data.tasks) {
    const normalized = normalizeRawTask(item);
    if (normalized) tasks.push(normalized);
  }

  return tasks;
}

export async function extractTasksFromTranscript(transcript: string): Promise<ExtractedMeetingTask[]> {
  const payload = truncateTranscript(transcript);
  if (!payload) {
    taskLog("task extraction skipped — empty transcript input");
    return [];
  }

  const { apiKey, models } = getGroqChatConfig();
  taskLog("task extraction started", {
    transcriptLength: payload.length,
    models,
    hasApiKey: Boolean(apiKey),
  });
  let lastError: Error | null = null;

  for (const model of models) {
    const requestBody = {
      model,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract action items from meeting transcripts. Return ONLY valid JSON:
{"tasks":[{"task":"string","owner":"string or null","deadline":"string or null"}]}
Rules:
- task: clear actionable item (required)
- owner: person responsible if mentioned, else null
- deadline: date/deadline if mentioned (YYYY-MM-DD preferred, or phrases like "next Friday"), else null
- Include follow-ups, assignments, and commitments
- If truly no action items, return {"tasks":[]}
- Do not invent owners or deadlines`,
        },
        {
          role: "user",
          content: `Extract every action item from this transcript:\n\n${payload}`,
        },
      ],
    };

    taskLog("task extraction Groq request", {
      model,
      transcriptLength: payload.length,
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
      taskLog("AI extraction response (raw)", {
        model,
        httpStatus: groqRes.status,
        bodyPreview: taskPreview(responseText, 2000),
      });

      if (!groqRes.ok) {
        throw new Error(
          `Groq task extraction failed (HTTP ${groqRes.status})${responseText ? `: ${responseText}` : ""}`,
        );
      }

      const json = JSON.parse(responseText) as GroqChatCompletionResponse;
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("Groq task extraction returned empty message content.");
      }

      taskLog("AI extraction response (content)", { preview: taskPreview(content, 2000) });

      return parseExtractionJson(content);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      taskError("task extraction Groq attempt failed", lastError, { model });
    }
  }

  throw lastError ?? new Error("All Groq models failed for task extraction.");
}
