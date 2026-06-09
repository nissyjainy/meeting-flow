import { assistantLog } from "./assistant-debug";
import type { AssistantCorpus, AssistantMeetingRecord, AssistantSearchHit } from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "they",
  "them",
  "their",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "he",
  "she",
  "him",
  "her",
  "his",
  "show",
  "list",
  "find",
  "get",
  "give",
  "tell",
  "summarize",
  "summary",
]);

export const DEFAULT_MAX_SEARCH_RESULTS = 8;
const TRANSCRIPT_SNIPPET_RADIUS = 280;

/** Pluggable retrieval — keyword fallback when vector index is unavailable. */
export interface AssistantSearchStrategy {
  search(
    query: string,
    corpus: AssistantCorpus,
    limit?: number,
  ): AssistantSearchHit[] | Promise<AssistantSearchHit[]>;
}

export function extractSearchTerms(query: string): string[] {
  const normalized = query.toLowerCase();
  const terms = normalized.match(/[a-z0-9][a-z0-9'@-]*/g) ?? [];
  const unique = new Set<string>();

  for (const term of terms) {
    if (term.length < 2 || STOP_WORDS.has(term)) continue;
    unique.add(term);
  }

  return [...unique];
}

function countTermMatches(text: string | null | undefined, terms: string[]): number {
  if (!text?.trim() || terms.length === 0) return 0;
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits;
}

function extractTranscriptSnippet(
  transcript: string | null,
  terms: string[],
): string | null {
  if (!transcript?.trim() || terms.length === 0) return null;

  const lower = transcript.toLowerCase();
  let index = -1;

  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found >= 0) {
      index = found;
      break;
    }
  }

  if (index < 0) {
    return transcript.slice(0, TRANSCRIPT_SNIPPET_RADIUS * 2).trim();
  }

  const start = Math.max(0, index - TRANSCRIPT_SNIPPET_RADIUS);
  const end = Math.min(transcript.length, index + TRANSCRIPT_SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < transcript.length ? "…" : "";
  return `${prefix}${transcript.slice(start, end).trim()}${suffix}`;
}

function scoreMeeting(
  meeting: AssistantMeetingRecord,
  terms: string[],
): AssistantSearchHit | null {
  if (terms.length === 0) return null;

  const matchedFields: string[] = [];
  let score = 0;

  const titleHits = countTermMatches(meeting.meetingTitle, terms);
  if (titleHits > 0) {
    score += titleHits * 12;
    matchedFields.push("title");
  }

  const summaryHits = countTermMatches(meeting.summary, terms);
  if (summaryHits > 0) {
    score += summaryHits * 8;
    matchedFields.push("summary");
  }

  const transcriptHits = countTermMatches(meeting.transcript, terms);
  if (transcriptHits > 0) {
    score += transcriptHits * 5;
    matchedFields.push("transcript");
  }

  for (const task of meeting.tasks) {
    const taskHits = countTermMatches(task.task, terms);
    if (taskHits > 0) {
      score += taskHits * 10;
      if (!matchedFields.includes("tasks")) matchedFields.push("tasks");
    }

    const ownerHits = countTermMatches(task.owner, terms);
    if (ownerHits > 0) {
      score += ownerHits * 14;
      if (!matchedFields.includes("owners")) matchedFields.push("owners");
    }

    const deadlineHits = countTermMatches(task.deadline, terms);
    if (deadlineHits > 0) {
      score += deadlineHits * 6;
      if (!matchedFields.includes("deadlines")) matchedFields.push("deadlines");
    }

    const statusHits = countTermMatches(task.status, terms);
    if (statusHits > 0) {
      score += statusHits * 4;
      if (!matchedFields.includes("status")) matchedFields.push("status");
    }
  }

  if (score <= 0) return null;

  return {
    meetingId: meeting.meetingId,
    score,
    matchedFields,
    transcriptSnippet: extractTranscriptSnippet(meeting.transcript, terms),
  };
}

export class KeywordAssistantSearchStrategy implements AssistantSearchStrategy {
  search(
    query: string,
    corpus: AssistantCorpus,
    limit = DEFAULT_MAX_SEARCH_RESULTS,
  ): AssistantSearchHit[] {
    const terms = extractSearchTerms(query);
    assistantLog("keyword search started", {
      terms,
      meetingCount: corpus.meetings.length,
      limit,
    });

    const hits: AssistantSearchHit[] = [];

    for (const meeting of corpus.meetings) {
      const hit = scoreMeeting(meeting, terms);
      if (hit) hits.push(hit);
    }

    hits.sort((a, b) => b.score - a.score);

    if (hits.length > 0) {
      assistantLog("keyword search hits", {
        hitCount: hits.length,
        topMeetingIds: hits.slice(0, limit).map((hit) => hit.meetingId),
      });
      return hits.slice(0, limit);
    }

    const fallback = corpus.meetings
      .filter((meeting) => meeting.pipelineStatus === "ready")
      .slice(0, Math.min(limit, 5))
      .map((meeting) => ({
        meetingId: meeting.meetingId,
        score: 0,
        matchedFields: ["recent"],
        transcriptSnippet: meeting.transcript
          ? meeting.transcript.slice(0, TRANSCRIPT_SNIPPET_RADIUS * 2)
          : null,
      }));

    assistantLog("keyword search fallback to recent meetings", {
      fallbackCount: fallback.length,
    });

    return fallback;
  }
}

export const defaultAssistantSearchStrategy = new KeywordAssistantSearchStrategy();

export async function searchRelevantMeetingsKeyword(
  query: string,
  corpus: AssistantCorpus,
  limit = DEFAULT_MAX_SEARCH_RESULTS,
): Promise<AssistantSearchHit[]> {
  return defaultAssistantSearchStrategy.search(query, corpus, limit);
}

/** When opened from a meeting page, keep that meeting in context even if keyword scores are low. */
export function pinMeetingInSearchHits(
  meetingId: string,
  hits: AssistantSearchHit[],
  corpus: AssistantCorpus,
  limit = DEFAULT_MAX_SEARCH_RESULTS,
): AssistantSearchHit[] {
  const meeting = corpus.meetings.find((entry) => entry.meetingId === meetingId);
  if (!meeting) return hits;

  const withoutPinned = hits.filter((hit) => hit.meetingId !== meetingId);
  const pinned: AssistantSearchHit = {
    meetingId,
    score: 10_000,
    matchedFields: ["focused"],
    transcriptSnippet: meeting.transcript
      ? meeting.transcript.slice(0, TRANSCRIPT_SNIPPET_RADIUS * 2)
      : null,
  };

  return [pinned, ...withoutPinned].slice(0, limit);
}
