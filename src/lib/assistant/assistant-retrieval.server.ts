import type { SupabaseClient } from "@supabase/supabase-js";
import { assistantLog } from "./assistant-debug";
import {
  pinMeetingInSearchHits,
  searchRelevantMeetingsKeyword,
} from "./assistant-search";
import { searchRelevantMeetingsVector } from "./assistant-vector-search.server";
import type { AssistantCorpus, AssistantSearchHit } from "./types";

export async function retrieveAssistantMeetingHits(
  supabase: SupabaseClient,
  query: string,
  corpus: AssistantCorpus,
  options?: { meetingId?: string | null },
): Promise<AssistantSearchHit[]> {
  let hits: AssistantSearchHit[] = [];
  let retrievalMode: "vector" | "keyword" = "vector";

  try {
    hits = await searchRelevantMeetingsVector(supabase, query, {
      meetingId: options?.meetingId ?? null,
    });
  } catch {
    retrievalMode = "keyword";
    hits = await searchRelevantMeetingsKeyword(query, corpus);
  }

  if (hits.length === 0) {
    retrievalMode = "keyword";
    hits = await searchRelevantMeetingsKeyword(query, corpus);
  }

  if (options?.meetingId) {
    hits = pinMeetingInSearchHits(options.meetingId, hits, corpus);
  }

  assistantLog("retrieval complete", {
    mode: retrievalMode,
    hitCount: hits.length,
    meetingId: options?.meetingId ?? null,
  });

  return hits;
}
