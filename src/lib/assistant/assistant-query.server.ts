import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadAssistantCorpus } from "./assistant-data.server";
import { buildAssistantContextWindow } from "./assistant-context.server";
import { generateAssistantAnswer } from "./assistant-llm.server";
import { assistantError, assistantLog } from "./assistant-debug";
import { searchRelevantMeetings } from "./assistant-search";
import type { AssistantQueryResult, AssistantSource } from "./types";

const AssistantQueryInput = z.object({
  query: z.string().min(1).max(1000),
});

function parseAssistantInput(raw: unknown): z.infer<typeof AssistantQueryInput> {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.query === "string") {
      return AssistantQueryInput.parse(obj);
    }
    if (obj.data && typeof obj.data === "object") {
      return AssistantQueryInput.parse(obj.data);
    }
  }
  return AssistantQueryInput.parse(raw);
}

function buildSources(
  hits: ReturnType<typeof searchRelevantMeetings>,
  corpus: Awaited<ReturnType<typeof loadAssistantCorpus>>,
): AssistantSource[] {
  const meetingById = new Map(corpus.meetings.map((meeting) => [meeting.meetingId, meeting]));

  return hits
    .map((hit) => {
      const meeting = meetingById.get(hit.meetingId);
      if (!meeting) return null;
      return {
        meetingId: meeting.meetingId,
        meetingTitle: meeting.meetingTitle,
        meetingDate: meeting.meetingDate,
      };
    })
    .filter((source): source is AssistantSource => source !== null);
}

function appendSourcesSection(answer: string, sources: AssistantSource[]): string {
  if (sources.length === 0) return answer;

  const unique = new Map<string, AssistantSource>();
  for (const source of sources) {
    unique.set(source.meetingId, source);
  }

  const lines = [...unique.values()].map(
    (source) => `• ${source.meetingTitle} (${source.meetingDate})`,
  );

  return `${answer.trim()}\n\nSources:\n${lines.join("\n")}`;
}

export const askAssistantFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => parseAssistantInput(raw))
  .handler(async ({ data }): Promise<AssistantQueryResult> => {
    const query = data.query.trim();
    assistantLog("query received", { queryPreview: query.slice(0, 200) });

    const supabase = getSupabaseServerClient();
    const corpus = await loadAssistantCorpus(supabase);

    if (corpus.meetings.length === 0) {
      return {
        answer:
          "You don't have any meetings yet. Upload a recording to start building your meeting memory, then ask questions across all your meetings.",
        sources: [],
        searchedMeetingCount: 0,
        contextMeetingCount: 0,
      };
    }

    const hits = searchRelevantMeetings(query, corpus);
    const sources = buildSources(hits, corpus);
    const context = buildAssistantContextWindow(hits, corpus);

    try {
      const llmAnswer = await generateAssistantAnswer(query, context);
      const answer = appendSourcesSection(llmAnswer, sources);

      assistantLog("query complete", {
        contextMeetingCount: hits.length,
        sourceCount: sources.length,
        answerLength: answer.length,
      });

      return {
        answer,
        sources,
        searchedMeetingCount: corpus.meetings.length,
        contextMeetingCount: hits.length,
      };
    } catch (error) {
      assistantError("query failed", error, { queryPreview: query.slice(0, 200) });
      throw error instanceof Error ? error : new Error("Assistant query failed");
    }
  });
