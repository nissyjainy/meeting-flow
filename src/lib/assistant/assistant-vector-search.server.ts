import type { SupabaseClient } from "@supabase/supabase-js";
import { generateQueryEmbedding } from "@/lib/meetings/embeddings.server";
import { assistantError, assistantLog } from "./assistant-debug";
import type { AssistantSearchHit } from "./types";

export const DEFAULT_VECTOR_CHUNK_LIMIT = 12;
export const DEFAULT_VECTOR_MEETING_LIMIT = 8;

type MatchMeetingChunkRow = {
  meeting_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
};

function groupChunkRows(rows: MatchMeetingChunkRow[]): AssistantSearchHit[] {
  const byMeeting = new Map<string, AssistantSearchHit>();

  for (const row of rows) {
    const snippet = {
      chunkIndex: row.chunk_index,
      text: row.chunk_text,
      score: row.similarity,
    };

    const existing = byMeeting.get(row.meeting_id);
    if (!existing) {
      byMeeting.set(row.meeting_id, {
        meetingId: row.meeting_id,
        score: row.similarity,
        matchedFields: ["semantic"],
        transcriptSnippet: row.chunk_text,
        chunkSnippets: [snippet],
      });
      continue;
    }

    existing.score = Math.max(existing.score, row.similarity);
    existing.chunkSnippets = [...(existing.chunkSnippets ?? []), snippet];
    existing.chunkSnippets.sort((a, b) => b.score - a.score);
    existing.transcriptSnippet = existing.chunkSnippets
      .slice(0, 3)
      .map((entry) => entry.text)
      .join("\n\n---\n\n");
    if (!existing.matchedFields.includes("semantic")) {
      existing.matchedFields.push("semantic");
    }
  }

  return [...byMeeting.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, DEFAULT_VECTOR_MEETING_LIMIT);
}

export async function searchMeetingChunksVector(
  supabase: SupabaseClient,
  query: string,
  options?: {
    meetingId?: string | null;
    chunkLimit?: number;
  },
): Promise<AssistantSearchHit[]> {
  const chunkLimit = options?.chunkLimit ?? DEFAULT_VECTOR_CHUNK_LIMIT;
  assistantLog("vector search started", {
    queryPreview: query.slice(0, 200),
    chunkLimit,
    meetingId: options?.meetingId ?? null,
  });

  const queryEmbedding = await generateQueryEmbedding(query);

  const { data, error } = await supabase.rpc("match_meeting_chunks", {
    query_embedding: queryEmbedding,
    match_count: chunkLimit,
    filter_meeting_id: options?.meetingId ?? null,
  });

  if (error) {
    throw new Error(`Vector chunk search failed: ${error.message}`);
  }

  const rows = (data ?? []) as MatchMeetingChunkRow[];
  const hits = groupChunkRows(rows);

  assistantLog("vector search complete", {
    rawChunkCount: rows.length,
    meetingHitCount: hits.length,
    topMeetingIds: hits.slice(0, 5).map((hit) => hit.meetingId),
  });

  return hits;
}

export async function searchRelevantMeetingsVector(
  supabase: SupabaseClient,
  query: string,
  options?: { meetingId?: string | null },
): Promise<AssistantSearchHit[]> {
  try {
    return await searchMeetingChunksVector(supabase, query, {
      meetingId: options?.meetingId ?? null,
    });
  } catch (error) {
    assistantError("vector search failed — caller should fall back", error, {
      queryPreview: query.slice(0, 120),
    });
    throw error;
  }
}
