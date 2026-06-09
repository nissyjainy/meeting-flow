import { assistantLog, assistantPreview } from "./assistant-debug";
import type { AssistantCorpus, AssistantMeetingRecord, AssistantSearchHit } from "./types";

const MAX_SUMMARY_CHARS = 900;

/** Shared budget for analytics + meeting context sent to the LLM. */
export const ASSISTANT_MAX_CONTEXT_CHARS = 28_000;

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function formatTasks(meeting: AssistantMeetingRecord): string {
  if (meeting.tasks.length === 0) return "No action items extracted.";

  return meeting.tasks
    .map((task) => {
      const owner = task.owner ? `Owner: ${task.owner}` : "Owner: unassigned";
      const deadline = task.deadline ? `Due: ${task.deadline}` : "Due: none";
      return `- [${task.status}] ${task.task} (${owner}; ${deadline})`;
    })
    .join("\n");
}

function buildMeetingContextBlock(
  meeting: AssistantMeetingRecord,
  hit: AssistantSearchHit,
): string {
  const lines = [
    `=== ${meeting.meetingTitle} (${meeting.meetingDate}) ===`,
    `Status: ${meeting.pipelineStatus}`,
    `Matched fields: ${hit.matchedFields.join(", ") || "recent"}`,
  ];

  if (meeting.summary) {
    lines.push(`Summary:\n${truncate(meeting.summary, MAX_SUMMARY_CHARS)}`);
  }

  if (hit.chunkSnippets?.length) {
    const chunkBlocks = hit.chunkSnippets
      .slice(0, 4)
      .map(
        (chunk) =>
          `[Chunk ${chunk.chunkIndex + 1}, relevance ${chunk.score.toFixed(3)}]\n${truncate(chunk.text, 1200)}`,
      );
    lines.push(`Relevant transcript passages:\n${chunkBlocks.join("\n\n")}`);
  } else {
    const transcriptExcerpt = hit.transcriptSnippet ?? truncate(meeting.transcript, 700);
    if (transcriptExcerpt) {
      lines.push(`Transcript excerpt:\n${transcriptExcerpt}`);
    }
  }

  lines.push(`Action items:\n${formatTasks(meeting)}`);
  return lines.join("\n");
}

export function buildAssistantContextWindow(
  hits: AssistantSearchHit[],
  corpus: AssistantCorpus,
): string {
  const meetingById = new Map(corpus.meetings.map((meeting) => [meeting.meetingId, meeting]));
  const blocks: string[] = [];

  const userLine = corpus.userEmail
    ? `Logged-in user: ${corpus.userName ?? corpus.userEmail} <${corpus.userEmail}>`
    : "Logged-in user: unknown";

  blocks.push(userLine);
  blocks.push(`Total meetings available: ${corpus.meetings.length}`);

  for (const hit of hits) {
    const meeting = meetingById.get(hit.meetingId);
    if (!meeting) continue;
    blocks.push(buildMeetingContextBlock(meeting, hit));
  }

  let context = blocks.join("\n\n");

  assistantLog("meeting context built", {
    meetingBlocks: hits.length,
    contextLength: context.length,
    preview: assistantPreview(context, 600),
  });

  return context;
}

export function combineAssistantContext(
  analyticsContext: string,
  meetingContext: string,
): string {
  const analyticsHeader = "=== WORKSPACE ANALYTICS (pre-computed) ===\n";
  const meetingsHeader = "\n\n=== RELEVANT MEETINGS ===\n";
  const prefix = `${analyticsHeader}${analyticsContext}${meetingsHeader}`;
  let combined = `${prefix}${meetingContext}`;

  if (combined.length > ASSISTANT_MAX_CONTEXT_CHARS) {
    const budget = ASSISTANT_MAX_CONTEXT_CHARS - prefix.length - 48;
    const trimmedMeetings =
      budget > 0
        ? meetingContext.slice(0, budget)
        : "";
    combined = `${prefix}${trimmedMeetings}\n\n[Meeting context truncated for model limits]`;
  }

  assistantLog("full context combined", {
    analyticsLength: analyticsContext.length,
    meetingLength: meetingContext.length,
    combinedLength: combined.length,
  });

  return combined;
}
